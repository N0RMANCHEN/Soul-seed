import test from "node:test";
import assert from "node:assert/strict";

import { formatSystemLocalIso, getSystemTimeZone } from "../dist/index.js";

test("formatSystemLocalIso returns ISO-8601 with local timezone offset", () => {
  const sample = new Date("2026-02-18T12:34:56.789Z");
  const localIso = formatSystemLocalIso(sample);

  assert.match(localIso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);

  const match = localIso.match(/([+-])(\d{2}):(\d{2})$/);
  assert.notEqual(match, null);
  const sign = match[1] === "+" ? 1 : -1;
  const offsetFromText = sign * (Number(match[2]) * 60 + Number(match[3]));
  const expected = -sample.getTimezoneOffset();
  // In UTC, "-00:00" and "+00:00" are semantically identical; normalize signed zero.
  const normalizeZero = (value) => (Object.is(value, -0) ? 0 : value);
  assert.equal(normalizeZero(offsetFromText), normalizeZero(expected));
});

test("getSystemTimeZone returns a string or null", () => {
  const tz = getSystemTimeZone();
  assert.equal(tz === null || typeof tz === "string", true);
});
