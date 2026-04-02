import { describe, expect, it } from "vitest";

import { formatDateTimeUnified, getNowDateTimeLocalInput, toDateTimeLocalInput, toIsoFromDateTimeLocal } from "../../lib/date-time";

describe("date-time utils", () => {
  it("formats postgres-like datetime with +00 timezone to readable text", () => {
    const value = "2026-04-02 03:25:08.618543+00";
    const formatted = formatDateTimeUnified(value);
    expect(formatted).toContain("2 April 2026");
    expect(formatted).toContain(",");
  });

  it("formats date-only to readable date", () => {
    expect(formatDateTimeUnified("2026-04-02")).toBe("2 April 2026");
  });

  it("converts to datetime-local format", () => {
    expect(toDateTimeLocalInput("2026-04-02T03:25:08+00:00")).toMatch(/^2026-04-02T\d{2}:\d{2}$/);
  });

  it("returns ISO for datetime-local value", () => {
    const iso = toIsoFromDateTimeLocal("2026-04-02T10:30");
    expect(iso).toMatch(/^2026-04-02T/);
    expect(iso?.endsWith("Z")).toBe(true);
  });

  it("returns now in datetime-local pattern", () => {
    expect(getNowDateTimeLocalInput()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
