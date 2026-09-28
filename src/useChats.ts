import { useCallback, useEffect, useState } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  updated: number;
}

export interface ChatSettings {
  apiKey: string; // the person's own OpenAI key, kept only on this device
  model: string;
}

const DEFAULT_MODEL = 'gpt-5-mini';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function usePersisted<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => load(key, fallback));
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage unavailable; keeps for this visit
    }
  }, [key, value]);
  return [value, setValue] as const;
}

/** ChatGPT conversations and the key to reach it, remembered on this device. Newest chat first. */
export function useChats() {
  const [chats, setChats] = usePersisted<Chat[]>('chats', []);
  const [settings, setSettings] = usePersisted<ChatSettings>('chatSettings', { apiKey: '', model: DEFAULT_MODEL });

  const newChat = useCallback(() => {
    const id = `${Date.now()}`;
    setChats(cs => [{ id, title: 'New chat', messages: [], updated: Date.now() }, ...cs]);
    return id;
  }, [setChats]);

  /** Replaces a chat's messages (while an answer streams in, the last one grows), keeping its place in the order. */
  const setMessages = useCallback(
    (id: string, messages: ChatMessage[]) =>
      setChats(cs => {
        const chat = cs.find(c => c.id === id);
        if (!chat) return cs;
        const first = messages.find(m => m.role === 'user')?.content ?? '';
        const title = chat.title === 'New chat' && first ? first.slice(0, 60) : chat.title;
        return cs.map(c => (c.id === id ? { ...chat, title, messages, updated: Date.now() } : c));
      }),
    [setChats],
  );

  const deleteChat = useCallback((id: string) => setChats(cs => cs.filter(c => c.id !== id)), [setChats]);

  /**
   * Adds chats brought over from ChatGPT at the top, newest first, leaving the order of the others alone.
   * One imported before is left as it is, since it may have been continued here.
   */
  const importChats = useCallback(
    (incoming: Chat[]) =>
      setChats(cs => {
        const have = new Set(cs.map(c => c.id));
        return [...incoming.filter(c => !have.has(c.id)).sort((a, b) => b.updated - a.updated), ...cs];
      }),
    [setChats],
  );

  /** Moves a chat to position `to` (0 = top). */
  const moveChat = useCallback(
    (id: string, to: number) =>
      setChats(cs => {
        const from = cs.findIndex(c => c.id === id);
        if (from < 0 || from === to) return cs;
        const next = [...cs];
        const [chat] = next.splice(from, 1);
        next.splice(Math.max(0, Math.min(to, next.length)), 0, chat);
        return next;
      }),
    [setChats],
  );

  return { chats, newChat, setMessages, deleteChat, importChats, moveChat, settings, setSettings };
}
