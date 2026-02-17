import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PersonaUserProfile } from "./types.js";

export interface ProfileUpdate {
  preferredName?: string;
  preferredLanguage?: string;
}

export function extractProfileUpdate(input: string): ProfileUpdate | null {
  const normalized = input.trim();

  const zhName = normalized.match(/(?:我叫|叫我|你可以叫我)\s*([\u4e00-\u9fa5A-Za-z0-9_\-]{1,24})/u);
  if (zhName?.[1]) {
    return { preferredName: zhName[1] };
  }

  const enName = normalized.match(/(?:my name is|call me)\s+([A-Za-z0-9_\-]{1,24})/i);
  if (enName?.[1]) {
    return { preferredName: enName[1] };
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
