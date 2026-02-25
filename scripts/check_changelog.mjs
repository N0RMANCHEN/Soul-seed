#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const pkgPath = path.resolve(process.cwd(), "package.json");
  const changelogPath = path.resolve(process.cwd(), "CHANGELOG.md");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  const version = String(pkg.version ?? "").trim();
  if (!version) {
    throw new Error("package.json 缺少 version 字段");
  }

  const content = await readFile(changelogPath, "utf8");
  const versionHeading = new RegExp(`^##\\s+\\[${escapeRegExp(version)}\\]\\s+-\\s+\\d{4}-\\d{2}-\\d{2}\\s*$`, "m");
  if (!versionHeading.test(content)) {
    throw new Error(`CHANGELOG.md 缺少当前版本条目: [${version}] - YYYY-MM-DD（任务完成后需持续增量记录）`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        version,
        check: "CHANGELOG entry exists (incremental task logging required)"
      },
      null,
      2
    )
  );
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        reason: error instanceof Error ? error.message : String(error)
      },
      null,
      2
    )
  );
  process.exit(1);
});
