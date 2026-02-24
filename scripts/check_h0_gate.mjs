#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

const REQUIRED = [
  {
    file: "config/h0/invariants.json",
    key: "invariants"
  },
  {
    file: "config/h0/budgets.json",
    key: "budgets"
  },
  {
    file: "config/h0/compat_constants.json",
    key: "compat_constants"
  },
  {
    file: "config/h0/regression_index.json",
    key: "regression_index"
  }
];

async function main() {
  const failures = [];
  for (const item of REQUIRED) {
    const filePath = path.resolve(process.cwd(), item.file);
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (typeof parsed.version !== "string" || !parsed.version.trim()) {
        failures.push(`${item.file}: missing or invalid "version"`);
      }
      if (typeof parsed.updatedAt !== "string" || !parsed.updatedAt.trim()) {
        failures.push(`${item.file}: missing or invalid "updatedAt"`);
      }
      if (!parsed[item.key] || typeof parsed[item.key] !== "object") {
        failures.push(`${item.file}: missing required key "${item.key}"`);
      }
    } catch (error) {
      failures.push(`${item.file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failures.length > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          gate: "H0",
          failures
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        gate: "H0",
        checked: REQUIRED.map((x) => x.file)
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        gate: "H0",
        failures: [error instanceof Error ? error.message : String(error)]
      },
      null,
      2
    )
  );
  process.exit(1);
});
