import { createHash } from "node:crypto";
import { existsSync, readdirSync, statSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// ── types ─────────────────────────────────────────────────────────────────────

export interface PersonaFileEntry {
  relativePath: string;
  sizeBytes: number;
  sha256: string;
}

export interface PersonaManifest {
  schema: "soulseed.persona.manifest.v1";
  exportedAt: string;
  personaId: string;
  displayName: string;
  files: PersonaFileEntry[];
}

export interface PersonaInspectResult {
  rootPath: string;
  personaId: string;
  displayName: string;
  createdAt: string;
  schemaVersion: string;
  fileCount: number;
  totalSizeBytes: number;
  lifeLogEventCount: number;
  attachmentCount: number;
  files: PersonaFileEntry[];
}

export interface PersonaImportResult {
  ok: boolean;
  destPath: string;
  personaId: string;
  displayName: string;
  filesImported: number;
  errors: string[];
  rollbackPerformed?: boolean;
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function sha256File(filePath: string): Promise<string> {
  const buf = await readFile(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

function collectFilePaths(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) {
    return results;
  }
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFilePaths(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

// ── inspect ───────────────────────────────────────────────────────────────────

export async function inspectPersonaPackage(rootPath: string): Promise<PersonaInspectResult> {
  const personaJsonPath = path.join(rootPath, "persona.json");
  if (!existsSync(personaJsonPath)) {
    throw new Error(`不是有效的 persona 目录：${rootPath}（缺少 persona.json）`);
  }

  const personaRaw = JSON.parse(await readFile(personaJsonPath, "utf8")) as Record<string, unknown>;
  const personaId = String(personaRaw.id ?? "");
  const displayName = String(personaRaw.displayName ?? "");
  const createdAt = String(personaRaw.createdAt ?? "");
  const schemaVersion = String(personaRaw.schemaVersion ?? "");

  const allPaths = collectFilePaths(rootPath);
  const files: PersonaFileEntry[] = [];
  let totalSizeBytes = 0;

  for (const fullPath of allPaths.sort()) {
    const stat = statSync(fullPath);
    const sha256 = await sha256File(fullPath);
    const relativePath = path.relative(rootPath, fullPath);
    files.push({ relativePath, sizeBytes: stat.size, sha256 });
    totalSizeBytes += stat.size;
  }

  const lifeLogPath = path.join(rootPath, "life.log.jsonl");
  let lifeLogEventCount = 0;
  if (existsSync(lifeLogPath)) {
    const content = await readFile(lifeLogPath, "utf8");
    lifeLogEventCount = content.split("\n").filter(Boolean).length;
  }

  const attachmentsDir = path.join(rootPath, "attachments");
  const attachmentCount = collectFilePaths(attachmentsDir).length;

  return {
    rootPath,
    personaId,
    displayName,
    createdAt,
    schemaVersion,
    fileCount: files.length,
    totalSizeBytes,
    lifeLogEventCount,
    attachmentCount,
    files
  };
}

// ── export ────────────────────────────────────────────────────────────────────

export async function exportPersonaPackage(rootPath: string, outPath: string): Promise<PersonaManifest> {
  const inspect = await inspectPersonaPackage(rootPath);

  if (existsSync(outPath)) {
    throw new Error(`导出目标已存在：${outPath}，请删除后重试`);
  }

  await mkdir(outPath, { recursive: true });

  for (const entry of inspect.files) {
    const srcFile = path.join(rootPath, entry.relativePath);
    const destFile = path.join(outPath, entry.relativePath);
    await mkdir(path.dirname(destFile), { recursive: true });
    await copyFile(srcFile, destFile);
  }

  const manifest: PersonaManifest = {
    schema: "soulseed.persona.manifest.v1",
    exportedAt: new Date().toISOString(),
    personaId: inspect.personaId,
    displayName: inspect.displayName,
    files: inspect.files
  };

  // Use EXPORT_MANIFEST.json to avoid case-insensitive FS conflict with manifest.json (v0.4)
  const EXPORT_MANIFEST_FILENAME = "EXPORT_MANIFEST.json";
  await writeFile(path.join(outPath, EXPORT_MANIFEST_FILENAME), JSON.stringify(manifest, null, 2), "utf8");

  return manifest;
}

// ── import ────────────────────────────────────────────────────────────────────

export async function importPersonaPackage(srcPath: string, destPath: string): Promise<PersonaImportResult> {
  const blankResult = (errors: string[]): PersonaImportResult => ({
    ok: false,
    destPath,
    personaId: "",
    displayName: "",
    filesImported: 0,
    errors
  });

  // 1. Verify manifest exists (EXPORT_MANIFEST.json avoids case conflict with manifest.json on macOS)
  const EXPORT_MANIFEST_FILENAME = "EXPORT_MANIFEST.json";
  const manifestPath = path.join(srcPath, EXPORT_MANIFEST_FILENAME);
  if (!existsSync(manifestPath)) {
    return blankResult([`${EXPORT_MANIFEST_FILENAME} 不存在于源路径，这不是有效的 persona 导出目录`]);
  }

  let manifest: PersonaManifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8")) as PersonaManifest;
  } catch {
    return blankResult([`${EXPORT_MANIFEST_FILENAME} 解析失败，文件可能已损坏`]);
  }

  if (manifest.schema !== "soulseed.persona.manifest.v1") {
    return blankResult([`不支持的 manifest schema: ${manifest.schema}`]);
  }

  // 2. Verify file hashes
  const hashErrors: string[] = [];
  for (const entry of manifest.files) {
    const srcFile = path.join(srcPath, entry.relativePath);
    if (!existsSync(srcFile)) {
      hashErrors.push(`文件缺失：${entry.relativePath}`);
      continue;
    }
    const actual = await sha256File(srcFile);
    if (actual !== entry.sha256) {
      hashErrors.push(
        `文件损坏（hash 不匹配）：${entry.relativePath} ` +
          `(预期 ${entry.sha256.slice(0, 8)}…，实际 ${actual.slice(0, 8)}…)`
      );
    }
  }

  if (hashErrors.length > 0) {
    return {
      ok: false,
      destPath,
      personaId: manifest.personaId,
      displayName: manifest.displayName,
      filesImported: 0,
      errors: hashErrors
    };
  }

  // 3. Check destination
  if (existsSync(destPath)) {
    return {
      ok: false,
      destPath,
      personaId: manifest.personaId,
      displayName: manifest.displayName,
      filesImported: 0,
      errors: [`目标路径已存在：${destPath}，请删除后重试或选择其他路径`]
    };
  }

  // 4. Copy files to destination with rollback on failure
  let filesImported = 0;
  try {
    await mkdir(destPath, { recursive: true });
    for (const entry of manifest.files) {
      const srcFile = path.join(srcPath, entry.relativePath);
      const destFile = path.join(destPath, entry.relativePath);
      await mkdir(path.dirname(destFile), { recursive: true });
      await copyFile(srcFile, destFile);
      filesImported++;
    }
  } catch (err) {
    // Rollback: remove partial destination
    try {
      await rm(destPath, { recursive: true, force: true });
    } catch {
      // ignore rollback failure
    }
    return {
      ok: false,
      destPath,
      personaId: manifest.personaId,
      displayName: manifest.displayName,
      filesImported,
      errors: [`导入失败：${err instanceof Error ? err.message : String(err)}`],
      rollbackPerformed: true
    };
  }

  return {
    ok: true,
    destPath,
    personaId: manifest.personaId,
    displayName: manifest.displayName,
    filesImported,
    errors: []
  };
}
