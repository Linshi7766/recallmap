import { expect, it } from "vitest";
import {
  assertEvidenceGrounded,
  normalizeSourceText,
} from "@/lib/domain/evidence";

it("normalizes whitespace and accepts verbatim evidence", () => {
  const source = normalizeSourceText("Correlation  measures\nassociation.");
  expect(() =>
    assertEvidenceGrounded(source, ["Correlation measures association."]),
  ).not.toThrow();
});

it("rejects invented evidence", () => {
  expect(() =>
    assertEvidenceGrounded("Correlation measures association.", [
      "Correlation proves causation.",
    ]),
  ).toThrow(/not found/i);
});
