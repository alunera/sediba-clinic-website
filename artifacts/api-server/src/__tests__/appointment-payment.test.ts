import { describe, expect, it } from "vitest";
import {
  appointmentCanBeConfirmed,
  appointmentRequiresPayment,
} from "../lib/appointment-payment";

describe("appointment payment requirements", () => {
  it("requires payment for any priced appointment, including consultations", () => {
    expect(appointmentRequiresPayment(35000)).toBe(true);
  });

  it("confirms free appointments without opening checkout", () => {
    expect(appointmentRequiresPayment(0)).toBe(false);
  });

  it("does not confirm a priced appointment before verified payment", () => {
    expect(appointmentCanBeConfirmed(35000, false)).toBe(false);
    expect(appointmentCanBeConfirmed(35000, true)).toBe(true);
    expect(appointmentCanBeConfirmed(0, false)).toBe(true);
  });
});