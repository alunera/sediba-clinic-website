import type { MouseEvent, ReactNode } from "react";
import { useLocation } from "wouter";

type StreamEvent = {
  content?: string;
  done?: boolean;
  error?: string;
};

export async function readAssistantStream(
  response: Response,
  onContent: (content: string) => void,
): Promise<void> {
  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    let detail = responseText;
    try {
      const body = JSON.parse(responseText) as { error?: string; message?: string };
      detail = body.error ?? body.message ?? responseText;
    } catch {}
    throw new Error(detail || `Request failed (${response.status})`);
  }
  if (!response.body) throw new Error("The assistant returned no response.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  const processEvent = (event: string) => {
    const payload = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!payload) return;

    let data: StreamEvent;
    try {
      data = JSON.parse(payload) as StreamEvent;
    } catch {
      throw new Error("The assistant returned an invalid response.");
    }
    if (data.error) throw new Error(data.error);
    if (typeof data.content === "string") onContent(data.content);
    if (data.done) finished = true;
  };

  while (!finished) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";
    for (const event of events) {
      processEvent(event);
      if (finished) break;
    }
    if (done) {
      if (buffer.trim()) processEvent(buffer);
      break;
    }
  }
}

const LINK_PATTERN = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const VERIFIED_EMAIL = "info@sedibawellnessclinic.co.za";
const VERIFIED_PHONE = "+27814566402";
const PRODUCTION_ORIGIN = "https://sedibawellnessclinic.co.za";
const BOOKING_QUERY_KEYS = ["treatment", "date", "time"];

function safeAssistantHref(rawHref: string): string | null {
  if (rawHref.toLowerCase() === `mailto:${VERIFIED_EMAIL}`) {
    return `mailto:${VERIFIED_EMAIL}`;
  }
  if (rawHref.replace(/[\s()-]/g, "") === `tel:${VERIFIED_PHONE}`) {
    return `tel:${VERIFIED_PHONE}`;
  }

  const isLegacyRelative = rawHref.startsWith("/") && !rawHref.startsWith("//");
  const isCanonicalAbsolute = rawHref.startsWith(`${PRODUCTION_ORIGIN}/`);
  if (!isLegacyRelative && !isCanonicalAbsolute) return null;

  let url: URL;
  try {
    url = new URL(rawHref, PRODUCTION_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PRODUCTION_ORIGIN || url.hash) return null;

  if (url.pathname === "/book-consultation") {
    return url.search ? null : `${PRODUCTION_ORIGIN}/book-consultation`;
  }
  if (url.pathname !== "/book" || !url.search) return null;
  if ([...url.searchParams.keys()].some((key) => !BOOKING_QUERY_KEYS.includes(key))) {
    return null;
  }
  const treatment = url.searchParams.get("treatment")?.trim();
  const date = url.searchParams.get("date");
  const time = url.searchParams.get("time");
  if (!treatment) return null;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  return `${PRODUCTION_ORIGIN}${url.pathname}${url.search}`;
}

export function AssistantMessage({ content }: { content: string }) {
  const [, setLocation] = useLocation();
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of content.matchAll(LINK_PATTERN)) {
    const index = match.index;
    if (index > cursor) nodes.push(content.slice(cursor, index));
    const href = safeAssistantHref(match[2]);
    if (href) {
      const localPath = href.startsWith(PRODUCTION_ORIGIN)
        ? href.slice(PRODUCTION_ORIGIN.length)
        : null;
      const handleClick = import.meta.env.DEV && localPath
        ? (event: MouseEvent<HTMLAnchorElement>) => {
            if (
              event.button !== 0
              || event.metaKey
              || event.ctrlKey
              || event.shiftKey
              || event.altKey
            ) {
              return;
            }
            event.preventDefault();
            setLocation(localPath);
          }
        : undefined;
      nodes.push(
        <a
          key={`${index}-${href}`}
          href={href}
          onClick={handleClick}
          data-testid={`link-assistant-action-${index}`}
          className="mt-3 inline-flex min-h-10 items-center justify-center border border-primary bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {match[1]}
        </a>,
      );
    } else {
      nodes.push(match[1]);
    }
    cursor = index + match[0].length;
  }
  if (cursor < content.length) nodes.push(content.slice(cursor));

  return <span className="whitespace-pre-wrap">{nodes}</span>;
}