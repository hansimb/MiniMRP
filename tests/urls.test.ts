import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExternalUrl } from "../lib/mappers/urls.ts";

test("normalizeExternalUrl adds https when the protocol is missing", () => {
  assert.equal(normalizeExternalUrl("www.musikding.de/pr05"), "https://www.musikding.de/pr05");
});

test("normalizeExternalUrl preserves existing absolute URLs", () => {
  assert.equal(normalizeExternalUrl("https://www.musikding.de/pr05"), "https://www.musikding.de/pr05");
  assert.equal(normalizeExternalUrl("http://www.musikding.de/pr05"), "http://www.musikding.de/pr05");
});

test("normalizeExternalUrl trims whitespace and returns null for empty input", () => {
  assert.equal(normalizeExternalUrl("  www.musikding.de/pr05  "), "https://www.musikding.de/pr05");
  assert.equal(normalizeExternalUrl("   "), null);
  assert.equal(normalizeExternalUrl(null), null);
});
