import { describe, expect, it } from "vitest";

import { formatRupiah, formatRupiahFromAny, parseRupiahToNumber } from "../../lib/currency";

describe("currency utils", () => {
  it("parses rupiah strings to number", () => {
    expect(parseRupiahToNumber("Rp150.000")).toBe(150000);
    expect(parseRupiahToNumber("Rp 1.250.500")).toBe(1250500);
  });

  it("returns 0 for invalid values", () => {
    expect(parseRupiahToNumber(null)).toBe(0);
    expect(parseRupiahToNumber(undefined)).toBe(0);
    expect(parseRupiahToNumber("abc")).toBe(0);
  });

  it("formats number to rupiah text", () => {
    expect(formatRupiah(100000)).toBe("Rp 100.000");
    expect(formatRupiah(-250000)).toBe("-Rp 250.000");
  });

  it("formats any value to rupiah text", () => {
    expect(formatRupiahFromAny("Rp75.000")).toBe("Rp 75.000");
    expect(formatRupiahFromAny(50000)).toBe("Rp 50.000");
  });
});
