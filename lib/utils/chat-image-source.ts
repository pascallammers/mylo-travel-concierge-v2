/**
 * Hosts whose images the chat may display. Everything else in chat Markdown
 * stays unloaded, so injected content cannot place tracking pixels.
 */
const ALLOWED_CHAT_IMAGE_HOSTS: ReadonlySet<string> = new Set(['imgcy.trivago.com']);

/**
 * Checks an image source against the chat image allowlist.
 *
 * @param raw - Image URL from a tool result or model-written Markdown.
 * @returns The normalized https URL if its host is allowed, otherwise undefined.
 */
export function readAllowedChatImageSource(raw: string): string | undefined {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  return url.protocol === 'https:' && !url.username && ALLOWED_CHAT_IMAGE_HOSTS.has(url.hostname) ? url.href : undefined;
}
