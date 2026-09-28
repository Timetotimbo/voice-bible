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

  /** Replaces a chat's messages (while an answer streams in, the last one grows) and moves it to the top. */
  const setMessages = useCallback(
    (id: string, messages: ChatMessage[]) =>
      setChats(cs => {
        const chat = cs.find(c => c.id === id);
        if (!chat) return cs;
        const first = messages.find(m => m.role === 'user')?.content ?? '';
        const title = chat.title === 'New chat' && first ? first.slice(0, 60) : chat.title;
        return [{ ...chat, title, messages, updated: Date.now() }, ...cs.filter(c => c.id !== id)];
      }),
    [setChats],
  );

  const deleteChat = useCallback((id: string) => setChats(cs => cs.filter(c => c.id !== id)), [setChats]);

  return { chats, newChat, setMessages, deleteChat, settings, setSettings };
}
