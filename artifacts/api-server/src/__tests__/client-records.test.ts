import { describe, expect, it, vi } from "vitest";
import { cleanClientFields, linkBookingClient, matchingClientId, validateClientFields } from "../lib/client-records";
import { requireAdmin } from "../middlewares/admin-auth";

describe("client record validation", () => {
  it("requires a nonblank name and one contact method", () => {
    expect(validateClientFields({ name: "  " }, true)).toMatch(/Name/);
    expect(validateClientFields({ name: "Jane" }, true)).toMatch(/contact/);
    expect(validateClientFields({ name: "Jane", email: "jane@example.com" }, true)).toBeNull();
    expect(validateClientFields({ name: "Jane", whatsapp: "+27 82 123 4567" }, true)).toBeNull();
    expect(validateClientFields({ name: "Jane", email: "bad address" }, true)).toMatch(/email/);
    expect(validateClientFields({ name: "x".repeat(201), phone: "123" }, true)).toMatch(/Name/);
    expect(validateClientFields({ name: "Jane", phone: "1".repeat(41) }, true)).toMatch(/phone/);
  });

  it("checks real calendar days and excludes future dates", () => {
    for (const dob of ["2023-02-29", "2020-13-01", "2100-01-01", "2020-2-01"]) {
      expect(validateClientFields({ name: "Jane", phone: "123", dateOfBirth: dob }, true)).toBeTruthy();
    }
    expect(validateClientFields({ name: "Jane", phone: "123", dateOfBirth: "2000-02-29" }, true)).toBeNull();
  });

  it("clears explicit nullable fields without clearing omitted fields", () => {
    expect(cleanClientFields({ phone: null, internalNotes: "", email: undefined })).toEqual({
      phone: null, internalNotes: null,
    });
    expect(validateClientFields({ name: "Jane", email: null, phone: null, whatsapp: null }, true)).toMatch(/contact/);
  });
});

describe("booking identity linkage", () => {
  const profiles = [
    { id: 10, name: "Jane Doe", email: "JANE@example.com", phone: "+27 82 555 0123", whatsapp: null },
    { id: 11, name: "Janet Doe", email: "janet@example.com", phone: null, whatsapp: null },
  ];
  it("matches normalized name plus contact, but never name alone", () => {
    expect(matchingClientId({ name: " jane  DOE ", email: "jane@EXAMPLE.com" }, profiles)).toBe(10);
    expect(matchingClientId({ name: "Jane Doe", phone: "0825550123" }, profiles)).toBe(10);
    expect(matchingClientId({ name: "Jane Doe" }, profiles)).toBeNull();
    expect(matchingClientId({ name: "Other Person", email: "jane@example.com" }, profiles)).toBeNull();
  });
  it("refuses ambiguous profiles rather than merging them", () => {
    expect(matchingClientId({ name: "Jane Doe", email: "jane@example.com" }, [
      ...profiles, { id: 12, name: "Jane Doe", email: "jane@example.com", phone: null, whatsapp: null },
    ])).toBeNull();
  });
  it("persists a new client once and reuses it for later bookings without changing its profile", async () => {
    const rows: Array<{ id: number; name: string; email: string | null; phone: string | null; whatsapp: string | null }> = [];
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: () => ({ from: async () => rows }),
      insert: () => ({ values: (value: Omit<typeof rows[number], "id">) => ({
        returning: async () => {
          const row = { ...value, id: rows.length + 1 };
          rows.push(row);
          return [{ id: row.id }];
        },
      }) }),
    };
    const id = await linkBookingClient(tx as never, { name: "Jane Doe", email: "Jane@Example.com" });
    expect(id).toBe(1);
    expect(await linkBookingClient(tx as never, { name: " jane doe ", email: "jane@example.com", phone: "0825550123" })).toBe(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.phone).toBeNull(); // booking snapshots must not overwrite an existing profile
    expect(tx.execute).toHaveBeenCalledTimes(2);
  });
});

describe("admin-only access", () => {
  it("rejects unauthenticated requests and allows authenticated sessions", () => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const next = vi.fn();
    requireAdmin({ session: {} } as never, { status, json } as never, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    requireAdmin({ session: { adminAuthenticated: true } } as never, { status, json } as never, next);
    expect(next).toHaveBeenCalledOnce();
  });
});