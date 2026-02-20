import test from "node:test";
import assert from "node:assert/strict";

import { runConsistencyKernel } from "../dist/index.js";

test("consistency kernel rejects provider identity contamination", () => {
  const result = runConsistencyKernel({
    personaName: "Roxy",
    constitution: {
      mission: "Stay consistent.",
      values: ["continuity"],
      boundaries: ["no fabricated facts"]
    },
    userInput: "你是谁",
    candidateText: "我是DeepSeek开发的助手。"
  });

  assert.equal(result.verdict, "reject");
  assert.equal(result.ruleHits.some((item) => item.ruleId === "identity_guard"), true);
});

test("consistency kernel allows neutral grounded text", () => {
  const result = runConsistencyKernel({
    personaName: "Roxy",
    constitution: {
      mission: "Stay consistent.",
      values: ["continuity"],
      boundaries: ["no fabricated facts"]
    },
    userInput: "你好",
    candidateText: "我在这，我们继续。"
  });

  assert.equal(result.verdict === "allow" || result.verdict === "rewrite", true);
});
