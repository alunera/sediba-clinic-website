import { describe,it,expect } from "vitest";
import { productSummary } from "../lib/profit-report";
import { createProductInput,updateProductInput } from "../lib/stock";
describe("separate product gross-margin calculation",()=>{
  it("uses historic cost snapshots, not price or current cost, and excludes services",()=>{
    const item={productId:1,description:"Serum",kind:"product",quantity:2,unitPriceCents:10000,unitCostCents:6000};
    const r=productSummary([{items:[item,{...item,kind:"service"}]},{items:[{...item,quantity:1,unitCostCents:7000}]}]);
    expect(r.productSalesCents).toBe(30000);
    expect(r.knownProductCostCents).toBe(19000);
    expect(r.products[0]?.grossMarginCents).toBe(11000);
  });
  it("does not fabricate profit for missing cost, but accepts explicit zero cost and negative margin",()=>{
    const base={description:"Product",kind:"product",quantity:1,unitPriceCents:100};
    const r=productSummary([{items:[{...base,productId:1,unitCostCents:null},{...base,productId:2,unitCostCents:0},
      {...base,productId:3,unitCostCents:200},{...base}]}]);
    expect(r.missingCostUnits).toBe(2);
    expect(r.products.find(p=>p.key==="product:1")?.grossMarginCents).toBeNull();
    expect(r.products.find(p=>p.key==="product:2")?.grossMarginCents).toBe(100);
    expect(r.products.find(p=>p.key==="product:3")?.grossMarginCents).toBe(-100);
  });
  it("returns a genuine empty report",()=>expect(productSummary([])).toEqual({products:[],productSalesCents:0,knownProductCostCents:0,missingCostUnits:0}));
  it("rejects fractional and negative unit costs",()=>{
    const p={name:"Test",sku:"T",unit:"bottle",reorderLevel:1,unitPriceCents:100,active:true,version:1,
      requestId:"product-cost-request",openingQuantity:1};
    for(const unitCostCents of [-1,0.5,100000001]) expect(updateProductInput.safeParse({...p,unitCostCents}).success).toBe(false);
    for(const unitCostCents of [null,0,100]) expect(createProductInput.safeParse({...p,unitCostCents}).success).toBe(true);
  });
});
