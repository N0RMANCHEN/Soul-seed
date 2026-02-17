import { createHash } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function eventHash(prevHash: string, eventWithoutHash: unknown): string {
  return sha256(`${prevHash}|${JSON.stringify(eventWithoutHash)}`);
}
