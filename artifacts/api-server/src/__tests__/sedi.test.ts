import { describe, expect, it, vi } from "vitest";
import { ALL_TREATMENTS } from "@workspace/treatment-catalog";
import {
  SEDI_TOOLS,
  SEDI_FAILURE_HANDOFF,
  SYSTEM_PROMPT,
  appendPreparedBookingLink,
  bookingLink,
  executeSediTool,
  formatClinicDateContext,
  formatTreatmentCatalog,
  type SediToolDependencies,
} from "../lib/sedi";

const dependencies = (
  available = [{ time: "10:00", available: true }],
): SediToolDependencies => ({
  availability: vi.fn().mockResolvedValue(available),
  resolveTreatment: vi.fn().mockImplementation(async (name: string) => ({
    id: 42,
    name,
  })),
});

describe("Sedi catalog and booking tools", () => {
  it("supplies the current Johannesburg date and weekday for relative dates", () => {
    expect(
      formatClinicDateContext(new Date("2030-01-04T22:30:00.000Z")),
    ).toContain("Saturday, 2030-01-05, in Africa/Johannesburg");
  });

  it("includes only the approved existing-form booking policy", () => {
    expect(SYSTEM_PROMPT).toContain("100% payment is required");
    expect(SYSTEM_PROMPT).toContain("less than 24 hours");
    expect(SYSTEM_PROMPT).toContain("at least 24 hours");
    expect(SYSTEM_PROMPT).toContain("5 minutes early");
    expect(SYSTEM_PROMPT).toContain("Policy acceptance is not confirmation");
  });

  it("builds its prompt catalog dynamically from the shared treatment package", () => {
    const catalog = formatTreatmentCatalog();
    for (const treatment of ALL_TREATMENTS) {
      expect(catalog).toContain(
        `• ${treatment.name} |`,
      );
      expect(catalog).toContain(treatment.price);
    }
    expect(catalog).not.toContain("Swedish Massage");
    expect(
      SEDI_TOOLS[1].function.parameters.properties.treatment.enum,
    ).toEqual(ALL_TREATMENTS.map((treatment) => treatment.name));
  });

  it("returns only availability read from the shared live service", async () => {
    const deps = dependencies([
      { time: "09:00", available: false },
      { time: "10:00", available: true },
    ]);
    const result = await executeSediTool(
      "get_availability",
      JSON.stringify({ date: "2030-06-10" }),
      deps,
    );

    expect(JSON.parse(result.output)).toEqual({
      ok: true,
      date: "2030-06-10",
      availableTimes: ["10:00"],
    });
    expect(deps.availability).toHaveBeenCalledWith("2030-06-10");
  });

  it("prepares a safe existing-form handoff without creating a booking", async () => {
    const deps = dependencies();
    const result = await executeSediTool(
      "prepare_booking",
      JSON.stringify({
        treatment: "The Glow",
        date: "2030-06-10",
        time: "10:00",
      }),
      deps,
    );

    expect(result.preparedLink).toBe(
      "[Continue booking The Glow](/book?treatment=The%20Glow&date=2030-06-10&time=10%3A00)",
    );
    expect(JSON.parse(result.output)).toMatchObject({
      ok: true,
      treatment: "The Glow",
      date: "2030-06-10",
      time: "10:00",
    });
  });

  it("strips every model-authored /book link but preserves consultation", () => {
    expect(
      appendPreparedBookingLink(
        "Ready. [Reserve now](/book?treatment=Fake) [Book a consultation](/book-consultation)",
        bookingLink("The Glow"),
      ),
    ).toBe(
      "Ready.  [Book a consultation](/book-consultation)\n\n[Continue booking The Glow](/book?treatment=The%20Glow)",
    );
  });

  it("returns an explicit handoff if bounded rounds produce no content", () => {
    expect(appendPreparedBookingLink("")).toBe(SEDI_FAILURE_HANDOFF);
    expect(
      appendPreparedBookingLink("[Try this](/book?treatment=Fake)"),
    ).toBe(SEDI_FAILURE_HANDOFF);
  });

  it("supports treatment-only preparation when the date is unknown", async () => {
    const result = await executeSediTool(
      "prepare_booking",
      JSON.stringify({
        treatment: "The Clarify",
        date: null,
        time: null,
      }),
      dependencies(),
    );
    expect(result.preparedLink).toBe(
      bookingLink("The Clarify"),
    );
  });

  it("rejects noncanonical names and unavailable times", async () => {
    const alias = await executeSediTool(
      "prepare_booking",
      JSON.stringify({
        treatment: "the glow",
        date: null,
        time: null,
      }),
      dependencies(),
    );
    expect(JSON.parse(alias.output).ok).toBe(false);

    const unavailable = await executeSediTool(
      "prepare_booking",
      JSON.stringify({
        treatment: "The Glow",
        date: "2030-06-10",
        time: "11:00",
      }),
      dependencies(),
    );
    expect(JSON.parse(unavailable.output)).toMatchObject({
      ok: false,
      error: "That time is not currently available.",
    });
    expect(unavailable.preparedLink).toBeUndefined();
  });

  it("rejects malformed tool arguments and time without a date", async () => {
    expect(
      JSON.parse((await executeSediTool("get_availability", "nope", dependencies())).output).ok,
    ).toBe(false);
    const result = await executeSediTool(
      "prepare_booking",
      JSON.stringify({
        treatment: "The Glow",
        date: null,
        time: "10:00",
      }),
      dependencies(),
    );
    expect(JSON.parse(result.output).error).toBe(
      "A date is required when a time is supplied.",
    );
  });

  it("rejects null arguments and impossible calendar dates without throwing", async () => {
    const nullArguments = await executeSediTool(
      "get_availability",
      "null",
      dependencies(),
    );
    expect(JSON.parse(nullArguments.output)).toEqual({
      ok: false,
      error: "Tool arguments must be a JSON object.",
    });

    const impossibleDate = await executeSediTool(
      "get_availability",
      JSON.stringify({ date: "2030-02-30" }),
      dependencies(),
    );
    expect(JSON.parse(impossibleDate.output)).toEqual({
      ok: false,
      error: "date must be YYYY-MM-DD",
    });
  });
});