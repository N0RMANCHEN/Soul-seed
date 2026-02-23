import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  initPersonaPackage,
  addTemporalLandmark,
  listTemporalLandmarks,
  listUpcomingTemporalLandmarks,
  formatUpcomingTemporalLandmarksBlock,
  removeTemporalLandmark
} from "../dist/index.js";

let tmpDir;

before(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "soulseed-temporal-landmarks-test-"));
  await initPersonaPackage(tmpDir, "TemporalDates");
});

after(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("temporal landmarks", () => {
  it("adds and lists entries", async () => {
    const e = await addTemporalLandmark(tmpDir, {
      title: "若溪生日",
      date: "2001-06-18",
      type: "birthday",
      personName: "若溪"
    });
    const all = await listTemporalLandmarks(tmpDir);
    assert.ok(all.some((x) => x.id === e.id));
  });

  it("computes upcoming recurring birthday in current year", async () => {
    await addTemporalLandmark(tmpDir, {
      title: "博飞生日",
      date: "1999-02-24",
      type: "birthday",
      personName: "博飞"
    });
    const nowMs = Date.parse("2026-02-23T09:00:00.000Z");
    const upcoming = await listUpcomingTemporalLandmarks(tmpDir, { nowMs, daysAhead: 5, maxItems: 10 });
    const hit = upcoming.find((x) => x.entry.title === "博飞生日");
    assert.ok(hit);
    assert.equal(hit.occurrenceDate, "2026-02-24");
    assert.equal(hit.daysFromNow, 1);
  });

  it("computes upcoming lunar recurring date", async () => {
    await addTemporalLandmark(tmpDir, {
      title: "春节",
      type: "holiday",
      calendar: "lunar",
      lunarMonth: 1,
      lunarDay: 1,
      recurringYearly: true
    });
    const nowMs = Date.parse("2026-02-10T00:00:00.000Z");
    const upcoming = await listUpcomingTemporalLandmarks(tmpDir, { nowMs, daysAhead: 20, maxItems: 10 });
    const hit = upcoming.find((x) => x.entry.title === "春节");
    assert.ok(hit);
    assert.equal(hit.occurrenceDate, "2026-02-17");
    assert.equal(hit.entry.calendar, "lunar");
  });

  it("formats upcoming block", async () => {
    const nowMs = Date.parse("2026-02-23T09:00:00.000Z");
    const upcoming = await listUpcomingTemporalLandmarks(tmpDir, { nowMs, daysAhead: 5, maxItems: 10 });
    const block = formatUpcomingTemporalLandmarksBlock(upcoming);
    assert.match(block, /## Important Dates/);
  });

  it("removes entry by id", async () => {
    const entry = await addTemporalLandmark(tmpDir, {
      title: "项目里程碑",
      date: "2026-03-01",
      type: "milestone",
      recurringYearly: false
    });
    const ok = await removeTemporalLandmark(tmpDir, entry.id);
    assert.equal(ok, true);
    const all = await listTemporalLandmarks(tmpDir);
    assert.equal(all.some((x) => x.id === entry.id), false);
  });
});
