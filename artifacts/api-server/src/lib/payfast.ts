/**
 * PayFast integration helpers (South African payment gateway).
 *
 * Mode is controlled by PAYFAST_MODE ("live" | anything else = sandbox).
 * Sandbox defaults to PayFast's public test credentials so the flow can be
 * exercised end-to-end without secrets; live mode REQUIRES
 * PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY and PAYFAST_PASSPHRASE.
 */
import { createHash } from "node:crypto";
import { logger } from "./logger";

const SANDBOX_MERCHANT_ID = "10000100";
const SANDBOX_MERCHANT_KEY = "46f0cd694581a";
const SANDBOX_PASSPHRASE = "jt7NOE43FZPn";

export function payfastMode(): "live" | "sandbox" {
  return process.env.PAYFAST_MODE === "live" ? "live" : "sandbox";
}

export function payfastHost(): string {
  return payfastMode() === "live" ? "www.payfast.co.za" : "sandbox.payfast.co.za";
}

export function payfastProcessUrl(): string {
  return `https://${payfastHost()}/eng/process`;
}

export function payfastCredentials(): { merchantId: string; merchantKey: string; passphrase: string } {
  if (payfastMode() === "live") {
    const merchantId = process.env.PAYFAST_MERCHANT_ID;
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
    const passphrase = process.env.PAYFAST_PASSPHRASE;
    if (!merchantId || !merchantKey || !passphrase) {
      throw new Error(
        "PayFast live mode requires PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY and PAYFAST_PASSPHRASE"
      );
    }
    return { merchantId, merchantKey, passphrase };
  }
  return {
    merchantId: process.env.PAYFAST_MERCHANT_ID || SANDBOX_MERCHANT_ID,
    merchantKey: process.env.PAYFAST_MERCHANT_KEY || SANDBOX_MERCHANT_KEY,
    passphrase: process.env.PAYFAST_PASSPHRASE || SANDBOX_PASSPHRASE,
  };
}

/** PayFast-style urlencoding: spaces become "+", uppercase hex. */
function pfEncode(value: string): string {
  return encodeURIComponent(value.trim()).replace(/%20/g, "+");
}

/**
 * MD5 signature over the fields in the given insertion order (PayFast
 * requires the documented field order for outbound forms and the received
 * order for ITN verification). Empty values are excluded.
 */
export function pfSignature(data: Record<string, string>, passphrase: string): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === "signature" || value === "" || value == null) continue;
    parts.push(`${key}=${pfEncode(value)}`);
  }
  let str = parts.join("&");
  if (passphrase) str += `&passphrase=${pfEncode(passphrase)}`;
  return createHash("md5").update(str).digest("hex");
}

/** Public base URL of this API server (used for PayFast notify_url). */
export function apiPublicBase(): string {
  if (process.env.PAYFAST_API_BASE_URL) return process.env.PAYFAST_API_BASE_URL.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    const domain = (process.env.REPLIT_DOMAINS || "").split(",")[0];
    if (domain) return `https://${domain}`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:8080";
}

/**
 * Public base URL of the customer-facing website (used for return/cancel
 * URLs). In production the site is served by Netlify — set SITE_BASE_URL
 * there; otherwise we fall back to the API host, which also serves the site.
 */
export function sitePublicBase(): string {
  if (process.env.SITE_BASE_URL) return process.env.SITE_BASE_URL.replace(/\/$/, "");
  return apiPublicBase();
}

export type PayfastFormData = { url: string; fields: Record<string, string> };

/**
 * Build the signed form-field set for redirecting a customer to PayFast.
 * Field insertion order follows PayFast's documented attribute order.
 */
export function buildPaymentForm(opts: {
  mPaymentId: string;
  amountCents: number;
  itemName: string;
  clientName: string;
  clientEmail: string;
  bookingRef: string;
}): PayfastFormData {
  const { merchantId, merchantKey, passphrase } = payfastCredentials();
  const site = sitePublicBase();
  const api = apiPublicBase();

  // Insertion order matters — do not reorder.
  const fields: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${site}/booking-confirmation?ref=${encodeURIComponent(opts.bookingRef)}&payment=return`,
    cancel_url: `${site}/booking-confirmation?ref=${encodeURIComponent(opts.bookingRef)}&payment=cancelled`,
    notify_url: `${api}/api/payments/payfast/itn`,
    name_first: opts.clientName.slice(0, 100),
    email_address: opts.clientEmail.slice(0, 255),
    m_payment_id: opts.mPaymentId,
    amount: (opts.amountCents / 100).toFixed(2),
    item_name: opts.itemName.slice(0, 100),
  };
  fields.signature = pfSignature(fields, passphrase);
  return { url: payfastProcessUrl(), fields };
}

/** Verify the signature of an ITN payload (received field order). */
export function verifyItnSignature(body: Record<string, string>): boolean {
  const { passphrase } = payfastCredentials();
  const received = body.signature ?? "";
  const expected = pfSignature(body, passphrase);
  return received === expected;
}

/**
 * Server-to-server confirmation: post the raw ITN body back to PayFast.
 * Returns true only when PayFast answers VALID.
 */
export async function confirmItnWithPayfast(rawBody: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${payfastHost()}/eng/query/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: rawBody,
    });
    const text = (await res.text()).trim();
    return text === "VALID";
  } catch (err) {
    logger.error({ err }, "[PayFast] validate callback failed");
    return false;
  }
}
