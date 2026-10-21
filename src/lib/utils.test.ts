import { describe, expect, it } from "vitest";
import { formatPhone } from "./utils";

describe("formatPhone", () => {
  it("formats a mobile number as (11) 99999-9999", () => {
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
  });

  it("formats a landline as (11) 9999-9999", () => {
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
  });

  it("formats partial input as the user types", () => {
    expect(formatPhone("1")).toBe("(1");
    expect(formatPhone("11")).toBe("(11");
    expect(formatPhone("119")).toBe("(11) 9");
    expect(formatPhone("11987")).toBe("(11) 987");
    expect(formatPhone("1198765")).toBe("(11) 9876-5");
  });

  it("ignores non-digit characters and caps at 11 digits", () => {
    expect(formatPhone("(11) 98765-4321")).toBe("(11) 98765-4321");
    expect(formatPhone("11 98765 4321 9999")).toBe("(11) 98765-4321");
  });

  it("returns empty for empty input", () => {
    expect(formatPhone("")).toBe("");
  });
});
