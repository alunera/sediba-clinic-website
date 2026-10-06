import { describe, expect, it } from "vitest";
import { createProductInput, updateProductInput, movementInput } from "../lib/stock";
import { saleInput } from "../lib/sales";
const p = { name:"Cleanser",sku:"SKU01",unit:"bottle",reorderLevel:2,unitPriceCents:25000,active:true,
  requestId:"stock-test-request-001",openingQuantity:3 };
describe("inventory input boundaries",() => {
  it("requires whole quantities, cent amounts and nonblank metadata",() => {
    expect(createProductInput.safeParse(p).success).toBe(true);
    for (const patch of [{name:" "},{sku:" "},{unit:" "},{openingQuantity:1.2},{reorderLevel:0.5},{unitPriceCents:1.2},{openingQuantity:-1}])
      expect(createProductInput.safeParse({...p,...patch}).success).toBe(false);
    expect(updateProductInput.safeParse({...p,version:1.5}).success).toBe(false);
  });
  it("only allows positive receipts/returns and signed nonzero adjustments",() => {
    const m = {requestId:p.requestId,kind:"received",quantity:1,reason:"Delivery note"};
    for (const quantity of [-1,0,0.1]) expect(movementInput.safeParse({...m,quantity}).success).toBe(false);
    expect(movementInput.safeParse({...m,kind:"adjustment",quantity:-1}).success).toBe(true);
    expect(movementInput.safeParse({...m,kind:"return",quantity:-1}).success).toBe(false);
    expect(movementInput.safeParse({...m,reason:" "}).success).toBe(false);
  });
  it("rejects fractional stock IDs and stock references on service lines",() => {
    const s = {requestId:p.requestId,clientId:1,items:[{description:"Cleanser",kind:"product",quantity:1,unitPriceCents:25000,productId:1}]};
    expect(saleInput.safeParse(s).success).toBe(true);
    expect(saleInput.safeParse({...s,items:[{...s.items[0],productId:1.5}]}).success).toBe(false);
    expect(saleInput.safeParse({...s,items:[{...s.items[0],kind:"service"}]}).success).toBe(false);
  });
});
