import { db, clientRecordsTable } from "@workspace/db";

type Contact = { name: string; email?: string | null; phone?: string | null; whatsapp?: string | null };
type Candidate = Contact & { id: number };

const nameKey = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
const emailKey = (value: string | null | undefined) => value?.trim().toLowerCase() || null;
const phoneKey = (value: string | null | undefined) => {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length >= 7 ? (digits.startsWith("27") && digits.length === 11 ? `0${digits.slice(2)}` : digits) : null;
};

/** Match only an unambiguous same-name profile sharing an actual contact. Never match on name alone. */
export function matchingClientId(contact: Contact, candidates: Candidate[]): number | null {
  const email = emailKey(contact.email);
  const phones = [phoneKey(contact.phone), phoneKey(contact.whatsapp)].filter((v): v is string => !!v);
  if (!email && phones.length === 0) return null;
  const matches = candidates.filter((candidate) =>
    nameKey(candidate.name) === nameKey(contact.name) &&
    ((email && email === emailKey(candidate.email)) ||
      phones.some((p) => p === phoneKey(candidate.phone) || p === phoneKey(candidate.whatsapp)))
  );
  return matches.length === 1 ? matches[0]!.id : null;
}

export function validateClientFields(fields: Record<string, unknown>, complete: boolean): string | null {
  const allowed = ["name", "email", "phone", "whatsapp", "dateOfBirth", "internalNotes"];
  if (Object.keys(fields).some((key) => !allowed.includes(key))) return "Unknown client field";
  if (complete || "name" in fields) {
    if (typeof fields.name !== "string" || !fields.name.trim() || fields.name.trim().length > 200) return "Name is required (maximum 200 characters)";
  }
  for (const [key, max] of [["email", 254], ["phone", 40], ["whatsapp", 40], ["internalNotes", 10000]] as const) {
    const value = fields[key];
    if (value !== undefined && value !== null && (typeof value !== "string" || value.trim().length > max)) return `${key} exceeds ${max} characters or is invalid`;
  }
  if (fields.email && (typeof fields.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))) return "Invalid email address";
  const dob = fields.dateOfBirth;
  if (dob !== undefined && dob !== null) {
    if (typeof dob !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return "Date of birth must be YYYY-MM-DD";
    const parsed = new Date(`${dob}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dob || dob > new Date().toISOString().slice(0, 10)) return "Date of birth must be a real date not in the future";
  }
  if (complete && !["email", "phone", "whatsapp"].some((key) => typeof fields[key] === "string" && (fields[key] as string).trim())) return "At least one contact method is required";
  return null;
}

export function cleanClientFields(fields: Record<string, unknown>): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const key of ["name", "email", "phone", "whatsapp", "dateOfBirth", "internalNotes"]) {
    if (fields[key] !== undefined) {
      const value = fields[key];
      result[key] = typeof value === "string" ? (value.trim() || (key === "name" ? "" : null)) : null;
    }
  }
  return result;
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function linkBookingClient(tx: Transaction, contact: Contact): Promise<number | null> {
  // Serialize lookup + insertion, preventing duplicate records from concurrent bookings.
  await tx.execute("SELECT pg_advisory_xact_lock(83412091)");
  const candidates = await tx.select().from(clientRecordsTable);
  const matched = matchingClientId(contact, candidates);
  if (matched) return matched;
  const values = cleanClientFields(contact as Record<string, unknown>);
  if (validateClientFields(values, true)) return null; // legacy booking input may lack a usable contact
  const [created] = await tx.insert(clientRecordsTable).values({
    name: values.name!,
    email: values.email ?? null,
    phone: values.phone ?? null,
    whatsapp: values.whatsapp ?? null,
  }).returning({ id: clientRecordsTable.id });
  return created!.id;
}