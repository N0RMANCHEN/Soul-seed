export function extractTextFromHtml(html: string): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCharCode(Number(num)))
    .replace(/\s{2,}/g, " ")
    .trim();
  return text.slice(0, 10000);
}

export function extractTextFromPdfRaw(raw: string): string {
  const blocks: string[] = [];
  const btEtPattern = /BT([\s\S]*?)ET/g;
  let match: RegExpExecArray | null;
  while ((match = btEtPattern.exec(raw)) !== null) {
    const block = match[1];
    const tjPattern = /\(([^)]*)\)\s*Tj/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjPattern.exec(block)) !== null) {
      blocks.push(tjMatch[1]);
    }
  }
  return blocks.join(" ").slice(0, 10000);
}

export interface FetchUrlResult {
  url: string;
  content: string;
  contentType: string;
  size: number;
}

const MAX_FETCH_BYTES = 2_000_000;
const FETCHABLE_CONTENT_TYPES = [
  "text/html",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/pdf",
  "application/xhtml+xml"
];

export async function fetchUrlContent(url: string, signal?: AbortSignal): Promise<FetchUrlResult> {
  const response = await fetch(url, {
    signal,
    headers: {
      "User-Agent": "SoulSeed/1.0 (web reader)"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_FETCH_BYTES) {
    throw new Error(`response_too_large: ${contentLength} bytes`);
  }
  if (!isFetchableContentType(contentType)) {
    throw new Error(`unsupported_content_type: ${contentType || "unknown"}`);
  }
  const buffer = await readResponseBodyLimited(response, MAX_FETCH_BYTES, signal);
  const size = buffer.byteLength;
  if (size > MAX_FETCH_BYTES) {
    throw new Error(`response_too_large: ${size} bytes`);
  }

  let content: string;

  if (contentType.includes("text/html")) {
    const html = new TextDecoder().decode(buffer);
    content = extractTextFromHtml(html);
  } else if (contentType.includes("application/pdf")) {
    const raw = new TextDecoder("latin1").decode(buffer);
    content = extractTextFromPdfRaw(raw);
    if (!content.trim()) {
      content = "(PDF 内容无法提取，可能是扫描件或加密文件)";
    }
  } else {
    content = new TextDecoder().decode(buffer).slice(0, 10000);
  }

  return { url, content, contentType, size };
}

function isFetchableContentType(contentType: string): boolean {
  const normalized = contentType.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.startsWith("text/")) {
    return true;
  }
  return FETCHABLE_CONTENT_TYPES.some((item) => normalized.startsWith(item));
}

async function readResponseBodyLimited(
  response: Response,
  maxBytes: number,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    return response.arrayBuffer();
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    if (signal?.aborted) {
      throw new Error("request_aborted");
    }
    const result = await reader.read();
    if (result.done) {
      break;
    }
    const chunk = result.value;
    total += chunk.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel("response_too_large");
      } catch {
        // ignore cancel errors
      }
      throw new Error(`response_too_large: ${total} bytes`);
    }
    chunks.push(chunk);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}
