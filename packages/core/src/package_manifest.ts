/**
 * Persona Package v0.4 — Manifest Schema (H/P1-4)
 *
 * manifest.json: package metadata, file registry, integrity checksum.
 * Schema: { schemaVersion, personaId, compatMode, createdAt, lastMigratedAt, checksum, files }
 */

export const MANIFEST_SCHEMA_VERSION = "0.4.0";
export const MANIFEST_FILENAME = "manifest.json";

export type ManifestCompatMode = "legacy" | "full";

export interface ManifestFileEntry {
  schemaVersion: string;
  updatedAt: string;
}

export interface PackageManifest {
  schemaVersion: string;
  personaId: string;
  compatMode: ManifestCompatMode;
  createdAt: string;
  lastMigratedAt: string;
  checksum: string;
  files: Record<string, ManifestFileEntry>;
}

export function isPackageManifest(raw: unknown): raw is PackageManifest {
  if (!raw || typeof raw !== "object") return false;
  const m = raw as Record<string, unknown>;
  return (
    typeof m.schemaVersion === "string" &&
    typeof m.personaId === "string" &&
    (m.compatMode === "legacy" || m.compatMode === "full") &&
    typeof m.createdAt === "string" &&
    typeof m.lastMigratedAt === "string" &&
    typeof m.checksum === "string" &&
    m.files != null &&
    typeof m.files === "object" &&
    !Array.isArray(m.files)
  );
}

export function normalizeManifest(raw: unknown): PackageManifest {
  if (!isPackageManifest(raw)) {
    throw new Error("Invalid manifest: missing required fields");
  }
  const files: Record<string, ManifestFileEntry> = {};
  for (const [k, v] of Object.entries(raw.files)) {
    if (v && typeof v === "object" && typeof (v as ManifestFileEntry).schemaVersion === "string") {
      const e = v as ManifestFileEntry;
      files[k] = {
        schemaVersion: e.schemaVersion,
        updatedAt: typeof e.updatedAt === "string" ? e.updatedAt : new Date().toISOString()
      };
    }
  }
  return {
    schemaVersion: raw.schemaVersion,
    personaId: raw.personaId,
    compatMode: raw.compatMode,
    createdAt: raw.createdAt,
    lastMigratedAt: raw.lastMigratedAt,
    checksum: raw.checksum,
    files
  };
}
