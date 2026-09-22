import { describe, expect, it } from "vitest";
import { combineAvailability } from "../lib/availability";

describe("shared live availability", () => {
  it("preserves configured order and excludes booked, cancelled-free, and past slots", () => {
    const result = combineAvailability(
      "2030-06-10",
      [{ time: "09:00" }, { time: "10:00" }, { time: "11:00" }],
      [{ time: "10:00" }],
      (_date, time) => time === "09:00",
    );

    expect(result).toEqual([
      { time: "09:00", available: false },
      { time: "10:00", available: false },
      { time: "11:00", available: true },
    ]);
  });

  it("returns no invented slots when the clinic configured none", () => {
    expect(
      combineAvailability("2030-06-10", [], [], () => false),
    ).toEqual([]);
  });
});