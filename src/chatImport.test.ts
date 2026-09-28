import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readConversations, readExportFile, readPastedChat } from './chatImport';

// Shaped like ChatGPT's export: a tree where the user edited their first question
const exported = [
  {
    id: 'abc',
    title: 'Fear in the Bible',
    update_time: 1790000000,
    current_node: 'a2',
    mapping: {
      root: { parent: null, message: null },
      sys: { parent: 'root', message: { author: { role: 'system' }, content: { content_type: 'text', parts: [''] } } },
      u1old: { parent: 'sys', message: { author: { role: 'user' }, content: { content_type: 'text', parts: ['first try'] } } },
      u1: { parent: 'sys', message: { author: { role: 'user' }, content: { content_type: 'text', parts: ['What does the Bible say about fear?'] } } },
      a1: { parent: 'u1', message: { author: { role: 'assistant' }, content: { content_type: 'text', parts: ['Isaiah 41:10 says fear not.'] } } },
      t1: { parent: 'a1', message: { author: { role: 'tool' }, content: { content_type: 'text', parts: ['search results'] } } },
      u2: { parent: 't1', message: { author: { role: 'user' }, content: { content_type: 'multimodal_text', parts: [{ asset: 'img' }, 'And this picture?'] } } },
      a2: { parent: 'u2', message: { author: { role: 'assistant' }, content: { content_type: 'text', parts: ['It shows a lamb.'] } } },
    },
  },
  { id: 'empty', title: 'Nothing', current_node: 'x', mapping: { x: { parent: null, message: null } } },
];

describe('importing ChatGPT chats', () => {
  it('follows the conversation as it was last shown, keeping only what was said', () => {
    const [chat, ...rest] = readConversations(exported);
    expect(rest).toHaveLength(0); // empty conversations are skipped
    expect(chat).toMatchObject({ id: 'gpt-abc', title: 'Fear in the Bible', updated: 1790000000000 });
    expect(chat.messages).toEqual([
      { role: 'user', content: 'What does the Bible say about fear?' },
      { role: 'assistant', content: 'Isaiah 41:10 says fear not.' },
      { role: 'user', content: 'And this picture?' },
      { role: 'assistant', content: 'It shows a lamb.' },
    ]);
  });

  it('reads the export zip', async () => {
    const zip = zipSync({ 'chat.html': strToU8('<html>'), 'conversations.json': strToU8(JSON.stringify(exported)) });
    const chats = await readExportFile(new File([zip], 'export.zip'));
    expect(chats[0].title).toBe('Fear in the Bible');
  });

  it('turns down files that aren’t an export', async () => {
    await expect(readExportFile(new File(['hello'], 'notes.txt'))).rejects.toThrow(/Couldn’t read/);
    await expect(readExportFile(new File([zipSync({ 'a.txt': strToU8('x') })], 'other.zip'))).rejects.toThrow(/No conversations/);
  });

  it('splits a pasted conversation by who said what', () => {
    const chat = readPastedChat('You said:\nWho wrote Romans?\nChatGPT said:\nPaul wrote Romans.\nSee Romans 1:1.\nYou said:\nThanks')!;
    expect(chat.messages).toEqual([
      { role: 'user', content: 'Who wrote Romans?' },
      { role: 'assistant', content: 'Paul wrote Romans.\nSee Romans 1:1.' },
      { role: 'user', content: 'Thanks' },
    ]);
    expect(chat.title).toBe('Who wrote Romans?');
  });

  it('keeps an unlabelled paste whole, for ChatGPT to carry on from', () => {
    const chat = readPastedChat('Some notes about grace', 'Grace')!;
    expect(chat.title).toBe('Grace');
    expect(chat.messages).toHaveLength(1);
    expect(chat.messages[0].content).toContain('Some notes about grace');
    expect(readPastedChat('   ')).toBeNull();
  });
});
