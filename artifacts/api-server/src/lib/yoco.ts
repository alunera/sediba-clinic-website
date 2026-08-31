import { createHmac, timingSafeEqual } from "node:crypto";

const YOCO_API_URL = "https://payments.yoco.com/api";

export function yocoMode(): "live" | "test" {
  return process.env.YOCO_MODE === "live" ? "live" : "test";
}

function secretKey(): string {
  const key =
    yocoMode() === "live"
      ? process.env.YOCO_LIVE_SECRET_KEY
      : process.env.YOCO_TEST_SECRET_KEY;
  if (!key) throw new Error(`YOCO_${yocoMode().toUpperCase()}_SECRET_KEY is required`);
  return key;
}

function webhookSecret(): string {
  const secret =
    yocoMode() === "live"
      ? process.env.YOCO_LIVE_WEBHOOK_SECRET
      : process.env.YOCO_TEST_WEBHOOK_SECRET;
  if (!secret) throw new Error(`YOCO_${yocoMode().toUpperCase()}_WEBHOOK_SECRET is required`);
  return secret;
}

export function assertYocoReady(): void {
  secretKey();
  webhookSecret();
}

export function sitePublicBase(): string {
  if (process.env.SITE_BASE_URL) return process.env.SITE_BASE_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:18944";
}

export async function createYocoCheckout(input: {
  checkoutId: string;
  bookingRef: string;
  amountCents: number;
  itemName: string;
}): Promise<{ id: string; redirectUrl: string; mode: "live" | "test" }> {
  const site = sitePublicBase();
  const response = await fetch(`${YOCO_API_URL}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.checkoutId,
    },
    body: JSON.stringify({
      amount: input.amountCents,
      currency: "ZAR",
      successUrl: `${site}/booking-confirmation?ref=${encodeURIComponent(input.bookingRef)}&payment=return`,
      cancelUrl: `${site}/booking-confirmation?ref=${encodeURIComponent(input.bookingRef)}&payment=cancelled`,
      failureUrl: `${site}/booking-confirmation?ref=${encodeURIComponent(input.bookingRef)}&payment=failed`,
      clientReferenceId: input.bookingRef,
      externalId: input.checkoutId,
      metadata: { bookingRef: input.bookingRef, checkoutId: input.checkoutId },
      lineItems: [{
        displayName: input.itemName.slice(0, 100),
        quantity: 1,
        pricingDetails: { price: input.amountCents },
      }],
    }),
  });

  const data = await response.json() as { id?: string; redirectUrl?: string; message?: string };
  if (!response.ok || !data.id || !data.redirectUrl) {
    throw new Error(data.message || `Yoco checkout creation failed (${response.status})`);
  }
  return { id: data.id, redirectUrl: data.redirectUrl, mode: yocoMode() };
}

export function verifyYocoWebhook(input: {
  rawBody: string;
  webhookId: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
}): boolean {
  if (!input.rawBody || !input.webhookId || !input.timestamp || !input.signature) return false;
  const timestampSeconds = Number(input.timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 180) {
    return false;
  }

  const encoded = webhookSecret().replace(/^whsec_/, "");
  const expected = createHmac("sha256", Buffer.from(encoded, "base64"))
    .update(`${input.webhookId}.${input.timestamp}.${input.rawBody}`)
    .digest("base64");

  return input.signature.split(" ").some((entry) => {
    const value = entry.split(",")[1];
    if (!value) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(value);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}