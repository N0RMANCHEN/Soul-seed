#!/usr/bin/env node
/**
 * H/P1-17, H/P1-18 — Appendix A schema validation
 *
 * Validates engagement_plan, interests, topic_state, proactive_plan
 * against JSON schemas in schemas/v1/.
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const SCHEMAS = [
  { name: "engagement_plan", file: "engagement_plan.schema.json" },
  { name: "interests", file: "interests.schema.json" },
  { name: "topic_state", file: "topic_state.schema.json" },
  { name: "proactive_plan", file: "proactive_plan.schema.json" },
];

async function main() {
  const ajv = new Ajv();
  const failures = [];

  for (const { name, file } of SCHEMAS) {
    const schemaPath = join(root, "schemas/v1", file);
    const schema = JSON.parse(await readFile(schemaPath, "utf8"));
    const validate = ajv.compile(schema);

    const fixturePath = join(root, "test/schemas/fixtures/appendix_a", `${name}.valid.json`);
    try {
      const data = JSON.parse(await readFile(fixturePath, "utf8"));
      if (!validate(data)) {
        failures.push({ name, errors: validate.errors });
      }
    } catch (err) {
      failures.push({ name, error: err.message });
    }
  }

  if (failures.length > 0) {
    console.error(JSON.stringify({ ok: false, failures }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, schemaCount: SCHEMAS.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
