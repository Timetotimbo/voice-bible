import { strFromU8, unzipSync } from 'fflate';
import type { ChatMessage } from './useChats';

/** A conversation brought over from ChatGPT, before it's added to the app's chats. */
export interface ImportedChat {
  id: string; // ChatGPT's own id where there is one, so importing twice doesn't duplicate
  title: string;
  messages: ChatMessage[];
  updated: number; // ms
}

interface ExportNode {
  parent?: string | null;
  message?: {
    author?: { role?: string };
    content?: { content_type?: string; parts?: unknown[] };
  } | null;
}

interface ExportConversation {
  id?: string;
  conversation_id?: string;
  title?: string;
  update_time?: number;
  create_time?: number;
  current_node?: string;
  mapping?: Record<string, ExportNode>;
}

/**
 * Reads ChatGPT's conversations.json (from Settings › Data controls › Export data). Each conversation is a
 * tree of edits and retries; the one shown in ChatGPT is the path from `current_node` back to the start.
 */
export function readConversations(json: unknown): ImportedChat[] {
  if (!Array.isArray(json)) throw new Error('This isn’t a ChatGPT conversations file.');
  return (json as ExportConversation[])
    .map((c, i) => {
      const mapping = c.mapping ?? {};
      const path: ExportNode[] = [];
      const seen = new Set<string>();
      for (let id = c.current_node; id && mapping[id] && !seen.has(id); id = mapping[id].parent ?? undefined) {
        seen.add(id);
        path.push(mapping[id]);
      }
      const messages: ChatMessage[] = path
        .reverse()
        .flatMap(node => {
          const role = node.message?.author?.role;
          if (role !== 'user' && role !== 'assistant') return []; // system notes, tools, browsing
          const text = (node.message?.content?.parts ?? []).filter((p): p is string => typeof p === 'string').join('\n').trim();
          return text ? [{ role, content: text } as ChatMessage] : [];
        });
      return {
        id: `gpt-${c.conversation_id ?? c.id ?? i}`,
        title: (c.title || messages.find(m => m.role === 'user')?.content || 'ChatGPT chat').slice(0, 80),
        messages,
        updated: Math.round((c.update_time ?? c.create_time ?? 0) * 1000),
      };
    })
    .filter(c => c.messages.length)
    .sort((a, b) => b.updated - a.updated);
}

/** Reads the export .zip ChatGPT emails, or the conversations.json inside it. */
export async function readExportFile(file: File): Promise<ImportedChat[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    // A zip: only unpack conversations.json
    const files = unzipSync(bytes, { filter: f => /(^|\/)conversations\.json$/.test(f.name) });
    const name = Object.keys(files)[0];
    if (!name) throw new Error('No conversations.json in this zip. Is it the ChatGPT export?');
    text = strFromU8(files[name]);
  } else {
    text = new TextDecoder().decode(bytes);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Couldn’t read this file. Choose the .zip from ChatGPT’s export email, or conversations.json.');
  }
  return readConversations(json);
}

// How copied ChatGPT conversations mark who's talking
const SPEAKER = /^\s*(You said|ChatGPT said|You|ChatGPT|User|Assistant|Me)\s*:\s*/i;

/**
 * Splits a pasted conversation into messages. Copying from ChatGPT labels turns "You said:" and
 * "ChatGPT said:"; without labels, the whole paste becomes one message for ChatGPT to pick up from.
 */
export function readPastedChat(text: string, title?: string): ImportedChat | null {
  const lines = text.replace(/\r/g, '').split('\n');
  const messages: ChatMessage[] = [];
  let current: ChatMessage | null = null;
  for (const line of lines) {
    const m = line.match(SPEAKER);
    if (m) {
      current = { role: /^(you|user|me)/i.test(m[1]) ? 'user' : 'assistant', content: line.slice(m[0].length) };
      messages.push(current);
    } else if (current) {
      current.content += `\n${line}`;
    }
  }
  const cleaned = messages.map(m => ({ ...m, content: m.content.trim() })).filter(m => m.content);
  const whole = text.trim();
  if (!whole) return null;
  const result = cleaned.length ? cleaned : [{ role: 'user' as const, content: `Here is an earlier conversation I had with ChatGPT, to carry on from:\n\n${whole}` }];
  return {
    id: `paste-${Date.now()}`,
    title: (title?.trim() || result.find(m => m.role === 'user')?.content.split('\n')[0] || 'Imported chat').slice(0, 80),
    messages: result,
    updated: Date.now(),
  };
}
