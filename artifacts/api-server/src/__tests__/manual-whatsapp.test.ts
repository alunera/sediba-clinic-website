import { describe,it,expect } from "vitest";
// Load the standalone browser helper at runtime; it is outside the API tsconfig root.
const browserHelperPath = new URL("../../../sediba-clinic/src/lib/manual-whatsapp.ts", import.meta.url).pathname;
const { whatsappNumber, manualMessage, safeReviewUrl } = await import(browserHelperPath);
import { sendWhatsAppMessage, sendBookingConfirmation, scheduleReminderMessage, rehydrateReminders } from "../lib/whatsapp";

describe("manual WhatsApp",()=>{
  it("normalizes local and international numbers without accepting arbitrary text",()=>{
    for(const input of ["082 123 4567","+27 (82) 123-4567","0027821234567"])
      expect(whatsappNumber(input)).toBe("27821234567");
    for(const input of ["","not a number","082","https://evil.test","+270821234567"])
      expect(whatsappNumber(input)).toBeNull();
    expect(whatsappNumber("+44 7700 900123")).toBe("447700900123");
  });
  it("requires safe HTTPS review links",()=>{
    expect(safeReviewUrl("javascript:alert(1)")).toBeNull();
    expect(safeReviewUrl("https://user:password@example.com")).toBeNull();
    expect(safeReviewUrl("https://g.page/r/example/review")).toBe("https://g.page/r/example/review");
  });
  it("uses exact dates, neutral review wording and safely encodable message text",()=>{
    const appt={clientName:"Test & Client",date:"2026-11-12",time:"09:30",bookingRef:"TEST-REF"};
    const text=manualMessage("reminder",appt,"Clinic","");
    expect(text).toContain("12/11/2026 at 09:30");
    expect(text).not.toContain("tomorrow");
    expect(decodeURIComponent(encodeURIComponent(text))).toBe(text);
    expect(manualMessage("review",appt,"Clinic","https://g.page/r/example")).toContain("honest Google review");
    expect(manualMessage("confirmation",appt,"Clinic","")).toContain("Your appointment is confirmed");
  });
  it("does not send or schedule automatic messages in manual mode",async()=>{
    const appt={appointmentId:1,bookingRef:"TEST",clientName:"Test",clientWhatsapp:null,serviceName:"Test",date:"2030-01-01",time:"09:00"};
    await expect(sendWhatsAppMessage("27821234567","test")).rejects.toThrow("disabled");
    await expect(sendBookingConfirmation(appt)).resolves.toBeUndefined();
    expect(scheduleReminderMessage(appt,new Date())).toBeUndefined();
    await expect(rehydrateReminders()).resolves.toBeUndefined();
  });
});
