// Opt-in only: uses isolated synthetic development records, removed in finally.
import { describe, it, expect } from "vitest";
import express from "express";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { GetBookkeepingResponse } from "@workspace/api-zod";
import router from "../routes/bookkeeping";
import { clinicToday } from "../lib/bookkeeping";

describe.skipIf(process.env.BOOKKEEPING_DB_TEST !== "1")("bookkeeping database contract", () => {
  it("preserves money and audit history through retries, competing matches and corrections", async () => {
    const prefix = `book-test-${randomUUID()}`;
    const date = clinicToday();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      Object.assign(req, { session: { adminAuthenticated: req.header("x-test-admin") === prefix }, log: { error() {} } });
      next();
    });
    app.use(router);
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address() as { port: number };
    const call = async (path: string, data?: unknown, auth = true) => {
      const r = await fetch(`http://127.0.0.1:${address.port}/admin/bookkeeping${path}`, {
        method: data === undefined ? "GET" : "POST",
        headers: { "Content-Type": "application/json", ...(auth ? { "x-test-admin": prefix } : {}) },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      return { status: r.status, data: await r.json() };
    };
    let clientId: number | undefined;
    let saleId: number | undefined;
    try {
      const { rows: [client] } = await pool.query("INSERT INTO client_records(name) VALUES($1) RETURNING id", [prefix]);
      clientId = client.id;
      const { rows: [sale] } = await pool.query(`INSERT INTO clinic_sales(request_id,client_id,client_name,items,total_cents)
        VALUES($1,$2,$1,'[]',10000) RETURNING id`, [prefix,clientId]);
      saleId = sale.id;
      const { rows: entries } = await pool.query(`INSERT INTO clinic_sale_entries(sale_id,request_id,kind,amount_cents,method,reason)
        VALUES($1,$2,'payment',6000,'cash',$2),($1,$3,'payment',4000,'eft',$3) RETURNING id`, [saleId,`${prefix}-r1`,`${prefix}-r2`]);
      const keys = entries.map(e => `sale:${e.id}`);
      const range = `?from=${date}&to=${date}`;
      expect((await call(range,undefined,false)).status).toBe(401);
      const before = GetBookkeepingResponse.parse((await call(range)).data);
      const expense = { requestId: `${prefix}-expense`, date, category: "rent", payee: prefix, reference: prefix, amountCents: 1000, method: "eft", paid: true };
      expect((await call("/expenses",expense)).status).toBe(200);
      expect((await call("/expenses",expense)).status).toBe(200);
      expect((await call("/expenses",{ ...expense,amountCents: 1001 })).status).toBe(409);
      expect((await call("/expenses",{ ...expense,requestId: `${prefix}-bad`,amountCents: 0.5 })).status).toBe(400);
      const deposit = { requestId: `${prefix}-deposit`, date, reference: prefix, bankCents: 9700, feeCents: 300, receiptKeys: keys, verified: true };
      expect((await call("/deposits",{ ...deposit,bankCents: 9701 })).status).toBe(409);
      const race = await Promise.all([
        call("/deposits",deposit),
        call("/deposits",{ ...deposit,requestId: `${prefix}-compete`,reference: `${prefix}-other` }),
      ]);
      expect(race.map(r => r.status).sort()).toEqual([200,409]);
      const won = race[0].status === 200 ? deposit : { ...deposit,requestId: `${prefix}-compete`,reference: `${prefix}-other` };
      expect((await call("/deposits",won)).status).toBe(200);
      const after = GetBookkeepingResponse.parse((await call(range)).data);
      expect(after.receivedCents).toBe(before.receivedCents);
      expect(after.expenseCents).toBe(before.expenseCents+1300);
      expect(after.netCashCents).toBe(before.netCashCents-1300);
      expect(after.unmatchedReceipts.filter((r: {key: string}) => keys.includes(r.key))).toHaveLength(0);
      const matched = after.deposits.find((d: {reference: string}) => d.reference === won.reference);
      expect((await call(`/deposits/${matched!.id}/void`,{ reason: "Incorrect bank statement entry" })).status).toBe(200);
      const released = GetBookkeepingResponse.parse((await call(range)).data);
      expect(released.unmatchedReceipts.filter((r: {key: string}) => keys.includes(r.key))).toHaveLength(2);
      expect(released.expenseCents).toBe(before.expenseCents+1000);
      expect(released.deposits.find((d: {id: number}) => d.id===matched!.id)!.voidReason).toBeTruthy();
      const e = released.rows.find((r: {description: string; kind: string}) => r.description===prefix && r.kind==="expense");
      expect((await call(`/expenses/${e!.key.split(":")[1]}/void`,{ reason: "Incorrect expense" })).status).toBe(200);
      expect(GetBookkeepingResponse.parse((await call(range)).data).netCashCents).toBe(before.netCashCents);
    } finally {
      await pool.query("DELETE FROM book_deposit_items WHERE deposit_id IN (SELECT id FROM book_deposits WHERE request_id LIKE $1)", [`${prefix}%`]);
      await pool.query("DELETE FROM book_deposits WHERE request_id LIKE $1", [`${prefix}%`]);
      await pool.query("DELETE FROM book_expenses WHERE request_id LIKE $1", [`${prefix}%`]);
      if (saleId) {
        await pool.query("DELETE FROM clinic_sale_entries WHERE sale_id=$1", [saleId]);
        await pool.query("DELETE FROM clinic_sales WHERE id=$1", [saleId]);
      }
      if (clientId) await pool.query("DELETE FROM client_records WHERE id=$1", [clientId]);
      await new Promise<void>((resolve,reject) => server.close(err => err ? reject(err) : resolve()));
    }
  }, 30000);
});
