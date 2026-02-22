export interface FactualGroundingGuardResult {
  text: string;
  corrected: boolean;
  reason: string | null;
  flags: string[];
}

export function enforceFactualGroundingGuard(
  reply: string,
  options?: { mode?: "greeting" | "proactive" | "general" }
): FactualGroundingGuardResult {
  const text = reply.trim();
  if (!text) {
    return { text: reply, corrected: false, reason: null, flags: [] };
  }

  // Guard ungrounded first-person real-world actions (e.g. "路过花店看到...").
  const ungroundedPersonalActionPatterns = [
    /(?:我)?(?:今天|刚刚|刚才|昨晚|昨天|前天|最近|路过).{0,26}(路过|经过|去了|去到|在|看到|看见|听到|闻到|买了).{0,30}(花店|咖啡店|商店|超市|公园|餐厅|电影院|机场|车站|路上|地铁|街上)/u,
    /i (?:just|today|yesterday|recently).{0,24}(passed by|walked by|saw|heard|went to|bought).{0,30}(shop|store|flower shop|cafe|street|station|airport|park|restaurant)/i,
    // Note: excludes "刚刚|刚才" (just now) to avoid false positives when Roxy
    // legitimately refers to reading content shared by the user in the current conversation.
    /我(?:昨晚|昨天|今天|前天|最近).{0,20}(读|看|翻|听|回看|重看|复盘).{0,20}(文章|那篇|内容|文本)/u
  ];

  const matched = ungroundedPersonalActionPatterns.some((pattern) => pattern.test(text));
  if (!matched) {
    return { text: reply, corrected: false, reason: null, flags: [] };
  }

  const mode = options?.mode ?? "general";
  const fallbackByMode: Record<"greeting" | "proactive" | "general", string> = {
    greeting: "我在这。你刚才那句没说完的话，想从哪里接上？",
    proactive: "你愿意的话，把你刚才在想的那件事讲给我听，我会认真接住。",
    general: "你愿意的话，告诉我你此刻最想说的那一段。"
  };

  return {
    text: fallbackByMode[mode],
    corrected: true,
    reason: "ungrounded_personal_action",
    flags: ["ungrounded_personal_action"]
  };
}
