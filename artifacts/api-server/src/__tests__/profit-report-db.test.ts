import { describe,it,expect } from "vitest";
import { randomUUID } from "node:crypto";
import express from "express";
import { pool } from "@workspace/db";
import router from "../routes/profit-report";
import { GetProfitReportResponse } from "@workspace/api-zod";

describe.skipIf(process.env.PROFIT_DB_TEST!=="1")("cash profit database reconciliation",()=>{
  it("counts cash refunds, paid expenses and withheld fees once, excludes voids/deposits, keeps product margins separate",async()=>{
    const key=`profit-test-${randomUUID()}`,date="2002-01-15";
    const app=express();
    app.use((req,_res,next)=>{Object.assign(req,{session:{adminAuthenticated:req.header("x-test-auth")===key}});next();});
    app.use(router);
    const server=app.listen(0,"127.0.0.1");
    await new Promise<void>(r=>server.once("listening",r));
    const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
    let clientId:number|undefined;
    try {
      const {rows:[client]}=await pool.query("INSERT INTO client_records(name) VALUES($1) RETURNING id",[key]);clientId=client.id;
      const items=[{description:key,kind:"product",quantity:2,unitPriceCents:10000,unitCostCents:6000}];
      const {rows:[sale]}=await pool.query(`INSERT INTO clinic_sales(request_id,client_id,client_name,items,total_cents,created_at)
        VALUES($1,$2,$1,$3,20000,$4::date) RETURNING id`,[key,clientId,JSON.stringify(items),date]);
      await pool.query(`INSERT INTO clinic_sale_entries(sale_id,request_id,kind,amount_cents,method,reason,created_at)
        VALUES($1,$2,'payment',10000,'cash','test',$4::date),($1,$3,'refund',2000,'cash','test',$4::date)`,
      [sale.id,`${key}-receipt`,`${key}-refund`,date]);
      await pool.query(`INSERT INTO book_expenses(request_id,date,category,payee,reference,amount_cents,method,voided_at,void_reason)
        VALUES($1,$4,'rent',$1,$1,3000,'eft',NULL,''),
        ($2,$4,'product_purchases',$2,$2,1000,'eft',NULL,''),
        ($3,$4,'other',$3,$3,9999,'eft',now(),'test void')`,[`${key}-rent`,`${key}-purchase`,`${key}-void`,date]);
      await pool.query(`INSERT INTO book_deposits(request_id,date,reference,bank_cents,fee_cents,gross_cents)
        VALUES($1,$2,$1,8500,500,9000)`,[key,date]);
      const path=`/admin/profit-report?from=${date}&to=${date}`;
      expect((await fetch(base+path)).status).toBe(401);
      expect((await fetch(base+"/admin/profit-report?from=bad&to=bad",{headers:{"x-test-auth":key}})).status).toBe(400);
      const result=await fetch(base+path,{headers:{"x-test-auth":key}});
      expect(result.status).toBe(200);
      const d=GetProfitReportResponse.parse(await result.json());
      expect(d.receivedCents).toBe(10000);
      expect(d.refundedCents).toBe(2000);
      expect(d.expenseCents).toBe(4500);
      expect(d.cashProfitCents).toBe(3500);
      expect(d.productSalesCents).toBe(20000);
      expect(d.knownProductCostCents).toBe(12000);
      expect(d.products[0]?.grossMarginCents).toBe(8000);
      expect(d.refundedSaleCount).toBe(1);
      // Voiding a matched deposit removes its fee, not any original receipt.
      await pool.query("UPDATE book_deposits SET voided_at=now(),void_reason='test void' WHERE request_id=$1",[key]);
      const after=GetProfitReportResponse.parse(await(await fetch(base+path,{headers:{"x-test-auth":key}})).json());
      expect(after.receivedCents).toBe(10000);
      expect(after.cashProfitCents).toBe(4000);
    } finally {
      await pool.query("DELETE FROM book_expenses WHERE request_id LIKE $1",[`${key}%`]);
      await pool.query("DELETE FROM book_deposits WHERE request_id=$1",[key]);
      if(clientId){
        await pool.query("DELETE FROM clinic_sale_entries WHERE sale_id IN(SELECT id FROM clinic_sales WHERE client_id=$1)",[clientId]);
        await pool.query("DELETE FROM clinic_sales WHERE client_id=$1",[clientId]);
        await pool.query("DELETE FROM client_records WHERE id=$1",[clientId]);
      }
      await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
    }
  },30000);
});
