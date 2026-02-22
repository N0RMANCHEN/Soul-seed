/**
 * P0-13: Persona-level write lock
 *
 * Prevents concurrent writes to the same persona by multiple CLI or MCP
 * processes. Uses a simple .lock file with PID + expiry (TTL = 30s).
 * Stale locks (process dead or TTL exceeded) are automatically reclaimed.
 */

import { existsSync, writeFileSync, unlinkSync, readFileSync } from "node:fs";
import path from "node:path";

const LOCK_FILENAME = ".lock";
const LOCK_TTL_MS = 30_000; // 30 seconds
const ACQUIRE_POLL_INTERVAL_MS = 50;
const ACQUIRE_TIMEOUT_MS = 10_000; // 10 seconds max wait

interface LockData {
  pid: number;
  expiresAt: number; // epoch ms
}

function lockPath(rootPath: string): string {
  return path.join(rootPath, LOCK_FILENAME);
}

function readLock(rootPath: string): LockData | null {
  const lp = lockPath(rootPath);
  if (!existsSync(lp)) return null;
  try {
    return JSON.parse(readFileSync(lp, "utf8")) as LockData;
  } catch {
    return null;
  }
}

function isLockStale(lock: LockData): boolean {
  if (Date.now() > lock.expiresAt) return true;
  // Check if the owning process is still alive
  try {
    process.kill(lock.pid, 0); // signal 0 = existence check only
    return false; // process exists
  } catch {
    return true; // process is dead
  }
}

function writeLock(rootPath: string): void {
  const data: LockData = { pid: process.pid, expiresAt: Date.now() + LOCK_TTL_MS };
  writeFileSync(lockPath(rootPath), JSON.stringify(data), { flag: "w" });
}

function releaseLock(rootPath: string): void {
  const lp = lockPath(rootPath);
  try {
    if (existsSync(lp)) unlinkSync(lp);
  } catch {
    // Ignore — best effort
  }
}

/**
 * Acquire the persona write lock, waiting up to ACQUIRE_TIMEOUT_MS.
 * Returns true on success, throws on timeout.
 */
async function acquirePersonaLock(rootPath: string): Promise<void> {
  const deadline = Date.now() + ACQUIRE_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const existing = readLock(rootPath);
    if (!existing || isLockStale(existing)) {
      // Attempt to claim the lock
      writeLock(rootPath);
      // Verify we won the race (re-read and check pid)
      const confirmed = readLock(rootPath);
      if (confirmed && confirmed.pid === process.pid) return;
      // Lost the race — retry
    }
    await new Promise<void>((resolve) => setTimeout(resolve, ACQUIRE_POLL_INTERVAL_MS));
  }

  throw new Error(
    `Failed to acquire persona write lock at ${rootPath} within ${ACQUIRE_TIMEOUT_MS}ms. ` +
      `Another process (PID ${readLock(rootPath)?.pid ?? "unknown"}) may be writing. ` +
      `If the other process has crashed, remove ${lockPath(rootPath)} manually.`
  );
}

/**
 * Wrap a write operation in a persona-level lock.
 * Guarantees exactly one writer at a time for the given persona root.
 *
 * @example
 * await withPersonaLock(personaPath, async () => {
 *   await writeMemory(...);
 * });
 */
export async function withPersonaLock<T>(rootPath: string, fn: () => Promise<T>): Promise<T> {
  await acquirePersonaLock(rootPath);
  try {
    return await fn();
  } finally {
    releaseLock(rootPath);
  }
}
