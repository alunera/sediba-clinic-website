type Item = { productId?: number; description: string; kind: string; quantity: number; unitPriceCents: number; unitCostCents?: number | null };
export function productSummary(sales: { items: Item[] }[]) {
  const groups = new Map<string, { key: string; name: string; quantity: number; salesCents: number; knownCostCents: number; missingCostUnits: number }>();
  for (const sale of sales) for (const item of sale.items) {
    if (item.kind !== "product") continue;
    const key = item.productId ? `product:${item.productId}` : `untracked:${item.description}`;
    const row = groups.get(key) ?? { key,name:item.description,quantity:0,salesCents:0,knownCostCents:0,missingCostUnits:0 };
    row.quantity += item.quantity;
    row.salesCents += item.quantity * item.unitPriceCents;
    if (item.unitCostCents == null) row.missingCostUnits += item.quantity;
    else row.knownCostCents += item.quantity * item.unitCostCents;
    groups.set(key,row);
  }
  const products = [...groups.values()].sort((a,b)=>b.salesCents-a.salesCents).map(r=>({
    ...r,grossMarginCents:r.missingCostUnits ? null : r.salesCents-r.knownCostCents,
  }));
  return { products,productSalesCents:products.reduce((s,r)=>s+r.salesCents,0),
    knownProductCostCents:products.reduce((s,r)=>s+r.knownCostCents,0),
    missingCostUnits:products.reduce((s,r)=>s+r.missingCostUnits,0) };
}
