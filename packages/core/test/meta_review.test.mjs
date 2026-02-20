import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import { initPersonaPackage, loadPersonaPackage, runMetaReviewLlm } from "../dist/index.js";

test("meta review rewrites reply when model returns rewrite verdict", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-core-meta-review-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");
  await initPersonaPackage(personaPath, "Teddy");
  const personaPkg = await loadPersonaPackage(personaPath);

  const adapter = {
    name: "mock-planner",
    async streamChat() {
      return {
        content: JSON.stringify({
          verdict: "rewrite",
          rewrittenReply: "这是重写后的回复。",
          rationale: "style_alignment",
          degradeOrRejectReason: "tone_too_harsh"
        })
      };
    }
  };

  const result = await runMetaReviewLlm({
    adapter,
    personaPkg,
    userInput: "帮我回复一下",
    candidateReply: "原始回复",
    consistencyVerdict: "allow",
    consistencyReasons: [],
    domain: "dialogue"
  });

  assert.equal(result.applied, true);
  assert.equal(result.verdict, "rewrite");
  assert.equal(result.rewrittenReply, "这是重写后的回复。");
  assert.equal(result.degradeOrRejectReason, "tone_too_harsh");
});
