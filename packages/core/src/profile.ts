import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PersonaUserProfile } from "./types.js";

export interface ProfileUpdate {
  preferredName?: string;
  preferredLanguage?: string;
}

const NAME_ALLOWED_PATTERN = /^[\u4e00-\u9fa5A-Za-z0-9_\-]{1,24}$/u;
const NAME_STOPWORDS = new Set([
  "时候",
  "的时候",
  "一下",
  "一下子",
  "名字",
  "重新",
  "这个",
  "那个",
  "自己",
  "一下吧",
  "一下吗",
  "一下呢"
]);

export function normalizePreferredNameCandidate(raw: string): string | null {
  const normalized = raw
    .trim()
    .replace(/^[\s,，:：;；.。!?！？"'“”‘’`~()\[\]{}<>《》【】]+/u, "")
    .replace(/[\s,，:：;；.。!?！？"'“”‘’`~()\[\]{}<>《》【】]+$/u, "")
    .trim();
  if (!normalized) {
    return null;
  }
  if (!NAME_ALLOWED_PATTERN.test(normalized)) {
    return null;
  }
  if (NAME_STOPWORDS.has(normalized)) {
    return null;
  }
  return normalized;
}

export function extractProfileUpdate(input: string): ProfileUpdate | null {
  const normalized = input.trim();

  const zhName = normalized.match(/(?:^|[，,\s。！？!?])(?:我的名字是|我名字是|我叫|你可以叫我|叫我)\s*([^\n。！？!?]{1,32})/u);
  const zhCandidate = normalizePreferredNameCandidate(zhName?.[1] ?? "");
  if (zhCandidate) {
    return { preferredName: zhCandidate };
  }

  const enName = normalized.match(/(?:^|[\s,.;!?])(?:my name is|call me)\s+([^\n.!?]{1,32})/i);
  const enCandidate = normalizePreferredNameCandidate(enName?.[1] ?? "");
  if (enCandidate) {
    return { preferredName: enCandidate };
  }

  const zhLang = normalized.match(/(?:请用|请使用)\s*(中文|英文|英语)/u);
  if (zhLang?.[1]) {
    return {
      preferredLanguage: zhLang[1] === "中文" ? "zh-CN" : "en-US"
    };
  }

  const enLang = normalized.match(/(?:please use|reply in)\s+(english|chinese)/i);
  if (enLang?.[1]) {
    return {
      preferredLanguage: enLang[1].toLowerCase() === "chinese" ? "zh-CN" : "en-US"
    };
  }

  return null;
}

export async function updateUserProfile(
  rootPath: string,
  patch: ProfileUpdate
): Promise<PersonaUserProfile> {
  const profilePath = path.join(rootPath, "user_profile.json");
  const raw = await readFile(profilePath, "utf8");
  const current = JSON.parse(raw) as PersonaUserProfile;

  const next: PersonaUserProfile = {
    ...current,
    ...patch
  };

  await writeFile(profilePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}
