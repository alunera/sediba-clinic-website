// Opt-in development integration test. All synthetic records are removed in finally.
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import express from "express";
import { pool } from "@workspace/db";
import { GetAppointmentReceiptsResponse, GetBookkeepingResponse, GetAdminFinancialReportResponse, GetPaymentStatusResponse } from "@workspace/api-zod";
import receiptRouter from "../routes/appointment-receipts";
import salesRouter from "../routes/sales";
import bookkeepingRouter from "../routes/bookkeeping";
import paymentsRouter from "../routes/payments";
import { clinicToday } from "../lib/bookkeeping";

describe.skipIf(process.env.REFUND_DB_TEST !== "1")("appointment refund database contract", () => {
  it("records once, caps concurrent refunds, isolates appointments and reports without new debt", async () => {
    const prefix = `refund-test-${randomUUID()}`;
    const ref = `SWC-${randomUUID().replace(/[^a-f]/g, "").slice(0,8).toUpperCase().padEnd(8,"Z")}`;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      Object.assign(req, { session: { adminAuthenticated: req.header("x-test-admin") === prefix }, log: { error() {} } });
      next();
    });
    app.use(receiptRouter, salesRouter, bookkeepingRouter, paymentsRouter);
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    const port = (server.address() as { port: number }).port;
    const call = async (path: string, data?: unknown, auth=true) => {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: data === undefined ? "GET" : "POST",
        headers: { "Content-Type": "application/json", ...(auth ? { "x-test-admin": prefix } : {}) },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      return { status: response.status, data: await response.json() };
    };
    let serviceId: number | undefined, appointmentId: number | undefined;
    const today = clinicToday();
    const range = `?from=${today}&to=${today}`;
    try {
      const { rows: [service] } = await pool.query(`INSERT INTO services(name,category,description,duration,price_cents)
        VALUES($1,'test','Synthetic refund test',30,10000) RETURNING id`, [prefix]);
      serviceId = service.id;
      const { rows: [appt] } = await pool.query(`INSERT INTO appointments(booking_ref,client_name,client_email,client_phone,service_id,date,time,total_amount_cents,status)
        VALUES($1,$2,'test@example.invalid','0000000000',$3,'2099-01-01',$2,10000,'confirmed') RETURNING id`, [ref,prefix,serviceId]);
      appointmentId = appt.id;
      const { rows: [cash] } = await pool.query(`INSERT INTO payments(appointment_id,booking_ref,m_payment_id,amount_cents,provider,method,status)
        VALUES($1,$2,$3,10000,'in_salon','cash','complete') RETURNING id`, [appointmentId,ref,prefix]);
      const path = `/admin/appointments/${appointmentId}/refunds`;
      const d = { requestId: `${prefix}-first`,paymentId: cash.id,amountCents: 3000,method: "cash",
        reference: prefix,reason: "Client cancelled",returned: true };
      expect((await call(path,d,false)).status).toBe(401);
      expect((await call(path,{ ...d,amountCents: 1.5 })).status).toBe(400);
      expect((await call(path,{ ...d,returned: false })).status).toBe(400);
      expect((await call(path,{ ...d,paymentId: cash.id+99999 })).status).toBe(400);
      expect((await call(path,{ ...d,method: "yoco" })).status).toBe(409);
      expect((await call(path,d)).status).toBe(200);
      expect((await call(path,d)).status).toBe(200);
      expect((await call(path,{ ...d,amountCents: 3001 })).status).toBe(409);
      const partial = GetAppointmentReceiptsResponse.parse((await call(`/admin/appointments/${appointmentId}/receipts`)).data);
      expect(partial.refunds).toHaveLength(1);
      expect(partial.refundedCents).toBe(3000);
      expect(partial.netReceiptsCents).toBe(7000);
      expect(partial.outstandingCents).toBe(0);
      expect(partial.bookingStatus).toBe("confirmed");
      // Only one of two competing refunds can use the remaining 7000 cents.
      const race = await Promise.all([1,2].map(i => call(path,{ ...d,requestId: `${prefix}-race${i}`,amountCents: 5000 })));
      expect(race.map(r => r.status).sort()).toEqual([200,409]);
      expect((await call(path,{ ...d,requestId: `${prefix}-last`,amountCents: 2000 })).status).toBe(200);
      const full = GetAppointmentReceiptsResponse.parse((await call(`/admin/appointments/${appointmentId}/receipts`)).data);
      expect(full.refundedCents).toBe(10000);
      expect(full.netReceiptsCents).toBe(0);
      expect(full.receipts[0]!.refundableCents).toBe(0);
      expect((await call(path,{ ...d,requestId: `${prefix}-over`,amountCents: 1 })).status).toBe(409);
      const status = GetPaymentStatusResponse.parse((await call(`/payments/status?ref=${ref}`)).data);
      expect(status.paymentStatus).toBe("complete");
      expect(status.refundedCents).toBe(10000);
      expect(status.outstandingCents).toBe(0);
      expect((await call("/payments/initiate",{ bookingRef: ref })).status).toBe(409);
      const report = GetAdminFinancialReportResponse.parse((await call(`/admin/financial-report${range}`)).data);
      const reportRows = report.rows.filter(r => r.reference === ref);
      expect(reportRows.filter(r => r.kind==="payment")).toHaveLength(1);
      expect(reportRows.filter(r => r.kind==="refund")).toHaveLength(3);
      expect(reportRows.filter(r => r.kind==="refund").reduce((s,r)=>s+r.amountCents,0)).toBe(10000);
      const books = GetBookkeepingResponse.parse((await call(`/admin/bookkeeping${range}`)).data);
      expect(books.rows.filter(r => r.reference===ref && r.kind==="refund")).toHaveLength(3);
      expect(books.unmatchedReceipts.some(r => r.key.startsWith("booking-refund:"))).toBe(false);
      // A verified Yoco receipt can be recorded after cancellation, but a failed attempt cannot.
      await pool.query("UPDATE appointments SET status='cancelled' WHERE id=$1", [appointmentId]);
      const { rows: [yoco] } = await pool.query(`INSERT INTO payments(appointment_id,booking_ref,m_payment_id,amount_cents,provider,status)
        VALUES($1,$2,$3,1000,'yoco','failed') RETURNING id`, [appointmentId,ref,`${prefix}-yoco`]);
      const yd = { ...d,requestId: `${prefix}-yref`,paymentId: yoco.id,amountCents: 500,method: "yoco",reference: `${prefix}-yref` };
      expect((await call(path,yd)).status).toBe(409);
      await pool.query("UPDATE payments SET status='complete' WHERE id=$1", [yoco.id]);
      expect((await call(path,yd)).status).toBe(200);
      expect((await call(path,{ ...yd,requestId: `${prefix}-ydup` })).status).toBe(409);
      const cancelled = GetAppointmentReceiptsResponse.parse((await call(`/admin/appointments/${appointmentId}/receipts`)).data);
      expect(cancelled.bookingStatus).toBe("cancelled");
    } finally {
      if (appointmentId) {
        await pool.query("DELETE FROM appointment_refunds WHERE payment_id IN (SELECT id FROM payments WHERE appointment_id=$1)", [appointmentId]);
        await pool.query("DELETE FROM payments WHERE appointment_id=$1", [appointmentId]);
        await pool.query("DELETE FROM appointments WHERE id=$1", [appointmentId]);
      }
      if (serviceId) await pool.query("DELETE FROM services WHERE id=$1", [serviceId]);
      await new Promise<void>((resolve,reject) => server.close(err => err ? reject(err) : resolve()));
    }
  },30000);
});
