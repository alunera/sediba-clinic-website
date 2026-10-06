import { describe, expect, it } from "vitest";
import express from "express";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import stockRouter from "../routes/stock";
import salesRouter from "../routes/sales";
import { ListStockResponse, ListStockMovementsResponse, CreateStockProductResponse } from "@workspace/api-zod";
const product = (data: unknown) => CreateStockProductResponse.parse(data);

describe.skipIf(process.env.STOCK_DB_TEST!=="1")("inventory transaction contract",() => {
  it("deducts sales once, prevents overselling, keeps history, and rolls back failed multi-product sales",async() => {
    const prefix=`stock-test-${randomUUID()}`, app=express();
    app.use(express.json());
    app.use((req,_res,next)=>{ Object.assign(req,{session:{adminAuthenticated:req.header("x-test-auth")===prefix},log:{error(){}}});next(); });
    app.use(stockRouter,salesRouter);
    const server=app.listen(0,"127.0.0.1");
    await new Promise<void>(resolve=>server.once("listening",resolve));
    const port=(server.address() as {port:number}).port;
    const call=async(path:string,body?:unknown,method=body?"POST":"GET",auth=true)=>{
      const r=await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:{"Content-Type":"application/json",...(auth?{"x-test-auth":prefix}:{})},
        body:body===undefined?undefined:JSON.stringify(body)});
      return {status:r.status,data:await r.json()};
    };
    let clientId:number|undefined;
    try {
      const {rows:[client]}=await pool.query("INSERT INTO client_records(name) VALUES($1) RETURNING id",[prefix]);
      clientId=client.id;
      expect((await call("/admin/stock",undefined,"GET",false)).status).toBe(401);
      const input={requestId:`${prefix}-p1`,name:prefix,sku:prefix,unit:"bottle",unitPriceCents:10000,reorderLevel:2,openingQuantity:5,active:true};
      const first=await call("/admin/stock",input);
      expect(first.status).toBe(200);
      const id=product(first.data).id;
      expect(product((await call("/admin/stock",input)).data).id).toBe(id);
      expect((await call("/admin/stock",{...input,openingQuantity:6})).status).toBe(409);
      expect((await call("/admin/stock",{...input,requestId:`prefix-duplicate-${prefix}`})).status).toBe(409);
      const movement={requestId:`${prefix}-delivery`,kind:"received",quantity:3,reason:"Delivery"};
      expect(product((await call(`/admin/stock/${id}/movements`,movement)).data).onHand).toBe(8);
      expect(product((await call(`/admin/stock/${id}/movements`,movement)).data).onHand).toBe(8);
      expect((await call(`/admin/stock/${id}/movements`,{...movement,quantity:4})).status).toBe(409);
      expect((await call(`/admin/stock/${id}/movements`,{...movement,requestId:`${prefix}-neg`,kind:"adjustment",quantity:-9})).status).toBe(409);
      const item={description:prefix,kind:"product",quantity:3,unitPriceCents:10000,productId:id};
      const sale={requestId:`${prefix}-sale`,clientId,items:[item],notes:prefix};
      expect((await call("/admin/sales",sale)).status).toBe(201);
      expect((await call("/admin/sales",sale)).status).toBe(201);
      const race=await Promise.all([1,2].map(i=>call("/admin/sales",{...sale,requestId:`${prefix}-race${i}`,items:[{...item,quantity:4}]})));
      expect(race.map(r=>r.status).sort()).toEqual([201,409]);
      const all=ListStockResponse.parse((await call("/admin/stock")).data);
      expect(all.find(p=>p.id===id)?.onHand).toBe(1);
      // First product has enough, second does not: whole sale and its first deduction must roll back.
      const second=await call("/admin/stock",{...input,requestId:`${prefix}-p2`,sku:`${prefix}-2`,openingQuantity:0});
      expect((await call("/admin/sales",{...sale,requestId:`${prefix}-atomic`,items:[{...item,quantity:1},{...item,productId:product(second.data).id,quantity:1}]})).status).toBe(409);
      expect(ListStockResponse.parse((await call("/admin/stock")).data).find(p=>p.id===id)?.onHand).toBe(1);
      const {rows:[failed]}=await pool.query("SELECT count(*)::int n FROM clinic_sales WHERE request_id=$1",[`${prefix}-atomic`]);
      expect(failed.n).toBe(0);
      const history=ListStockMovementsResponse.parse((await call(`/admin/stock/${id}/movements`)).data);
      expect(history.filter(m=>m.kind==="sale")).toHaveLength(2);
      expect(history.reduce((s,m)=>s+m.quantity,0)).toBe(1);
      expect((await call(`/admin/stock/${id}`,{...input,unit:"box",version:1},"PATCH")).status).toBe(409);
      expect((await call(`/admin/stock/${id}`,{...input,active:false,version:1},"PATCH")).status).toBe(200);
      expect((await call(`/admin/stock/${id}`,{...input,version:1},"PATCH")).status).toBe(409);
      expect((await call("/admin/sales",{...sale,requestId:`${prefix}-archived`,items:[{...item,quantity:1}]})).status).toBe(409);
      expect(product((await call(`/admin/stock/${id}/movements`,{...movement,requestId:`${prefix}-return`,kind:"return",quantity:1})).data).onHand).toBe(2);
      expect(product((await call(`/admin/stock/${id}`,{...input,version:2},"PATCH")).data).active).toBe(true);
    } finally {
      await pool.query("DELETE FROM stock_movements WHERE product_id IN(SELECT id FROM stock_products WHERE request_id LIKE $1)",[`${prefix}%`]);
      await pool.query("DELETE FROM stock_products WHERE request_id LIKE $1",[`${prefix}%`]);
      if(clientId) {
        await pool.query("DELETE FROM clinic_sale_entries WHERE sale_id IN(SELECT id FROM clinic_sales WHERE client_id=$1)",[clientId]);
        await pool.query("DELETE FROM clinic_sales WHERE client_id=$1",[clientId]);
        await pool.query("DELETE FROM client_records WHERE id=$1",[clientId]);
      }
      await new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
    }
  },30000);
});
