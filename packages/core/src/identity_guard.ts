export interface IdentityGuardResult {
  text: string;
  corrected: boolean;
  reason: string | null;
}

const CONTAMINATION_PATTERNS = [
  /(我是\s*deepseek)/iu,
  /(由\s*deepseek\s*开发)/iu,
  /(deepseek\s*(开发|提供)的\s*ai助手)/iu,
  /(i\s+am\s+deepseek)/i,
  /(developed\s+by\s+deepseek)/i
];

export function enforceIdentityGuard(
  reply: string,
  personaName: string,
  userInput?: string
): IdentityGuardResult {
  const text = reply.trim();
  if (!text) {
    return { text: reply, corrected: false, reason: null };
  }

  const contaminated = CONTAMINATION_PATTERNS.some((pattern) => pattern.test(text));
  if (!contaminated) {
    return { text: reply, corrected: false, reason: null };
  }

  const lowerInput = (userInput ?? "").toLowerCase();
  const asksProvider = /deepseek|模型|provider|llm|谁开发|谁创造/.test(lowerInput);

  const safeText = asksProvider
    ? `我是${personaName}。底层模型可能来自不同提供方，但我的身份不属于任何模型厂商。`
    : `我是${personaName}。我的身份由本地 persona 文件定义，不隶属于任何模型提供方。`;

  return {
    text: safeText,
    corrected: true,
    reason: "provider_identity_contamination"
  };
}
