import type { ChatMessage } from './useChats';

const SYSTEM = [
  'You are a warm, careful Bible study helper inside a KJV Bible app.',
  'Quote the King James Version, and always give references as Book Chapter:Verse (for example "Romans 8:28" or "1 John 4:7-8") so they can be tapped to open.',
  'Answer in plain text without Markdown formatting such as ** or #. Keep answers clear and reasonably short unless asked for more.',
  'Where Christians hold different views, say so fairly.',
].join(' ');

export class ChatError extends Error {}

/**
 * Sends the conversation to OpenAI with the person's own key and calls `onText` with the answer so far
 * as it streams in. Returns the whole answer.
 */
export async function askChatGPT(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  onText: (soFar: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, stream: true, messages: [{ role: 'system', content: SYSTEM }, ...messages] }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ChatError('Couldn’t reach ChatGPT. Check your internet connection.');
  }
  if (!res.ok || !res.body) {
    const detail = await res.json().then(j => j?.error?.message as string | undefined, () => undefined);
    if (res.status === 401) throw new ChatError('That API key didn’t work. Check it under “API key”.');
    if (res.status === 429) throw new ChatError(detail ?? 'OpenAI says the key is out of credit or sending too fast.');
    if (res.status === 404) throw new ChatError(detail ?? `The model “${model}” isn’t available to this key.`);
    throw new ChatError(detail ?? `ChatGPT answered with an error (${res.status}).`);
  }

  // Server-sent events: lines of "data: {json}", ending with "data: [DONE]"
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const data = line.replace(/^data: ?/, '').trim();
      if (!line.startsWith('data:') || !data || data === '[DONE]') continue;
      try {
        const piece = JSON.parse(data).choices?.[0]?.delta?.content;
        if (piece) {
          text += piece;
          onText(text);
        }
      } catch {
        // a partial or unexpected line; skip it
      }
    }
  }
  return text;
}
