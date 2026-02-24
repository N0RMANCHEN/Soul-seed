import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveCapabilityIntent,
  evaluateCapabilityPolicy,
  computeProactiveStateSnapshot,
  decideProactiveEmission,
  extractTextFromHtml
} from "../dist/index.js";

test("resolveCapabilityIntent recognizes proactive and mode intents", () => {
  const proactiveStatus = resolveCapabilityIntent("/proactive status");
  assert.equal(proactiveStatus.matched, true);
  assert.equal(proactiveStatus.request?.name, "session.proactive_status");

  const modeUpdate = resolveCapabilityIntent("strict_memory_grounding on confirmed=true");
  assert.equal(modeUpdate.matched, true);
  assert.equal(modeUpdate.request?.name, "session.set_mode");

  const readByQuestion = resolveCapabilityIntent("/Users/hirohi/Desktop/a.md 是这个,你能阅读吗");
  assert.equal(readByQuestion.matched, true);
  assert.equal(readByQuestion.request?.name, "session.read_file");
  assert.equal(readByQuestion.request?.input?.path, "/Users/hirohi/Desktop/a.md");

  const readByDirectPath = resolveCapabilityIntent("/Users/hirohi/Desktop/a.md 看这个");
  assert.equal(readByDirectPath.matched, true);
  assert.equal(readByDirectPath.request?.name, "session.read_file");
  assert.equal(readByDirectPath.request?.input?.path, "/Users/hirohi/Desktop/a.md");

  const exitDirect = resolveCapabilityIntent("我走了");
  assert.equal(exitDirect.matched, true);
  assert.equal(exitDirect.request?.name, "session.exit");
  assert.equal(exitDirect.request?.input?.confirmed, true);
});

test("evaluateCapabilityPolicy enforces owner and confirmation gates", () => {
  const rejected = evaluateCapabilityPolicy(
    {
      name: "session.set_mode",
      input: { modeKey: "adult_mode", modeValue: true, confirmed: true },
      source: "dialogue"
    },
    {
      cwd: process.cwd(),
      ownerKey: "secret"
    }
  );
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.reason, "owner_auth_failed");

  const allowed = evaluateCapabilityPolicy(
    {
      name: "session.set_mode",
      input: {
        ownerToken: "secret",
        modeKey: "adult_mode",
        modeValue: true,
        confirmed: true
      },
      source: "dialogue"
    },
    {
      cwd: process.cwd(),
      ownerKey: "secret"
    }
  );
  assert.equal(allowed.status, "allow");

  const exitNeedsConfirm = evaluateCapabilityPolicy(
    {
      name: "session.exit",
      input: {},
      source: "dialogue"
    },
    {
      cwd: process.cwd()
    }
  );
  assert.equal(exitNeedsConfirm.status, "confirm_required");

  const exitAllowed = evaluateCapabilityPolicy(
    {
      name: "session.exit",
      input: { confirmed: true },
      source: "dialogue"
    },
    {
      cwd: process.cwd()
    }
  );
  assert.equal(exitAllowed.status, "allow");
});

test("resolveCapabilityIntent recognizes fetch_url intents", () => {
  const byNaturalLanguage = resolveCapabilityIntent("帮我看看 https://example.com");
  assert.equal(byNaturalLanguage.matched, true);
  assert.equal(byNaturalLanguage.request?.name, "session.fetch_url");
  assert.equal(byNaturalLanguage.request?.input?.url, "https://example.com/");

  const bySlashFetch = resolveCapabilityIntent("/fetch https://example.com/article");
  assert.equal(bySlashFetch.matched, true);
  assert.equal(bySlashFetch.request?.name, "session.fetch_url");
  assert.equal(bySlashFetch.request?.input?.url, "https://example.com/article");

  const byReadKeyword = resolveCapabilityIntent("阅读 https://example.com/page");
  assert.equal(byReadKeyword.matched, true);
  assert.equal(byReadKeyword.request?.name, "session.fetch_url");
  assert.equal(byReadKeyword.request?.input?.url, "https://example.com/page");

  const withTrailingChinese = resolveCapabilityIntent("https://www.book18.org/222535你能看这个网站吗");
  assert.equal(withTrailingChinese.matched, true);
  assert.equal(withTrailingChinese.request?.name, "session.fetch_url");
  assert.equal(withTrailingChinese.request?.input?.url, "https://www.book18.org/222535");
});

test("evaluateCapabilityPolicy enforces fetch_url rules", () => {
  const confirmRequired = evaluateCapabilityPolicy(
    { name: "session.fetch_url", input: { url: "https://example.com" }, source: "dialogue" },
    { cwd: process.cwd() }
  );
  assert.equal(confirmRequired.status, "confirm_required");
  assert.equal(confirmRequired.reason, "first_fetch_origin_confirmation_required");

  const allowedAfterConfirm = evaluateCapabilityPolicy(
    { name: "session.fetch_url", input: { url: "https://example.com", confirmed: true }, source: "dialogue" },
    { cwd: process.cwd() }
  );
  assert.equal(allowedAfterConfirm.status, "allow");
  assert.equal(allowedAfterConfirm.reason, "fetch_url_allowed");

  const allowedAfterOriginApproved = evaluateCapabilityPolicy(
    { name: "session.fetch_url", input: { url: "https://example.com/path" }, source: "dialogue" },
    { cwd: process.cwd(), approvedFetchOrigins: new Set(["https://example.com"]) }
  );
  assert.equal(allowedAfterOriginApproved.status, "allow");
  assert.equal(allowedAfterOriginApproved.reason, "fetch_url_allowed");

  const allowlistReject = evaluateCapabilityPolicy(
    { name: "session.fetch_url", input: { url: "https://blocked.example.com", confirmed: true }, source: "dialogue" },
    { cwd: process.cwd(), fetchOriginAllowlist: new Set(["https://example.com"]) }
  );
  assert.equal(allowlistReject.status, "rejected");
  assert.equal(allowlistReject.reason, "fetch_origin_not_allowed");

  const allowlistAcceptByWildcard = evaluateCapabilityPolicy(
    { name: "session.fetch_url", input: { url: "https://docs.example.com", confirmed: true }, source: "dialogue" },
    { cwd: process.cwd(), fetchOriginAllowlist: new Set(["*.example.com"]) }
  );
  assert.equal(allowlistAcceptByWildcard.status, "allow");

  const missingUrl = evaluateCapabilityPolicy(
    { name: "session.fetch_url", input: {}, source: "dialogue" },
    { cwd: process.cwd() }
  );
  assert.equal(missingUrl.status, "rejected");
  assert.equal(missingUrl.reason, "missing_url");

  const invalidScheme = evaluateCapabilityPolicy(
    { name: "session.fetch_url", input: { url: "ftp://example.com" }, source: "dialogue" },
    { cwd: process.cwd() }
  );
  assert.equal(invalidScheme.status, "rejected");
  assert.equal(invalidScheme.reason, "invalid_url_scheme");

  const invalidUrl = evaluateCapabilityPolicy(
    { name: "session.fetch_url", input: { url: "not-a-url" }, source: "dialogue" },
    { cwd: process.cwd() }
  );
  assert.equal(invalidUrl.status, "rejected");
  assert.equal(invalidUrl.reason, "invalid_url");
});

test("extractTextFromHtml strips scripts, nav, footer and decodes entities", () => {
  const html = `
    <html>
      <head><style>body { color: red; }</style></head>
      <body>
        <nav><a href="/">Home</a></nav>
        <script>alert("hidden")</script>
        <main><p>Hello &amp; World &lt;3&gt;</p></main>
        <footer>Copyright 2024</footer>
      </body>
    </html>
  `;
  const text = extractTextFromHtml(html);
  assert.equal(text.includes("Hello & World <3>"), true);
  assert.equal(text.includes("alert"), false);
  assert.equal(text.includes("Copyright"), false);
  assert.equal(text.includes("Home"), false);
});

test("proactive engine snapshot + decision are bounded", () => {
  const snapshot = computeProactiveStateSnapshot({
    curiosity: 0.3,
    annoyanceBias: -0.1,
    silenceMinutes: 10,
    topicAffinity: 0.9,
    recentEmissionCount: 3
  });
  assert.equal(snapshot.probability >= 0.01 && snapshot.probability <= 0.92, true);
  assert.equal(Array.isArray(snapshot.gateReasons), true);
  assert.equal(typeof snapshot.topicAffinity, "number");

  const decisionHit = decideProactiveEmission(snapshot, 0);
  assert.equal(decisionHit.emitted, true);
  assert.equal(typeof decisionHit.frequencyWindowHit, "boolean");
});
