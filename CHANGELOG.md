# Changelog

Each version is tagged in git and published as a GitHub release. To see or restore an older version, open the repo's Releases page.

## v1.36.0 — 2026-09-29
- Insert a verse into a note: in a note, tap Insert, then type (or say) a reference like "John 3:16" or "Psalm 23", or some words. A reference lists its chapter with the verse already ticked (tick the ones around it too); words list the matching verses. Tap "Insert N verses" and they go into the note where your cursor was, written out with the reference.
- Inserting now always lands where your cursor was in the note (it used to go to the end when Insert took the focus away).

## v1.35.1 — 2026-09-29
- Lists has a "+ New" button on its header, like Notes and ChatGPT. It opens Lists and shows the name box ready to type; the box is out of the way otherwise (✕ to cancel). Saving verses still offers a new list right there.

## v1.35.0 — 2026-09-29
- Rainbow theme, in all seven colours in order (red, orange, yellow, green, blue, indigo, violet): a rainbow stripe across the top, a rainbow mic, rainbow Play and Search buttons and titles, and verse numbers and verse cards that run through the seven colours down the page. Pick it from the palette icon.
- The Play button's words ("Play chapter", "Play all 3,877") fit again on phones up to about 420 pixels wide, including the Galaxy S22.

## v1.34.0 — 2026-09-29
- Colours: tap the new palette icon at the top (between the speaker and bookmark icons) to pick a theme: Purple Night (as before), Midnight Blue, Forest, Rose, Parchment (warm and paper-like), Light, or Match phone (light or dark with your phone's setting). The choice is remembered on each device, and the phone's status bar takes the theme's colour.
- The big mic's glow pulses again while listening (a clash with the Dictate button's blink had turned it into a blink).
- The top bar fits on narrower phones.

## v1.33.1 — 2026-09-28
- Fix: voice search was searching one word at a time ("heaven", then "and earth") since v1.32.1. It now waits a moment for you to finish and searches the whole phrase ("heaven and earth"), and partial words don't end up in your history.

## v1.33.0 — 2026-09-28
- Drag the Lists, Notes and ChatGPT sections into the order you like: press and hold the ⠿ handle on a section's header and move it up or down. It's easiest with the sections folded. The order is remembered on each device.
- Dragging lists, chats, notes and sections now follows your finger, so a tall open section drops where you point.

## v1.32.1 — 2026-09-28
- Fix: doubled words when dictating (and in voice search). Chrome on Android, listening continuously, repeats the earlier words at the start of each new phrase and sometimes sends a phrase twice; now only the new words are added. There was only ever one microphone listening.
- Fix: when two phrases arrived together, the first could be lost from the note.

## v1.32.0 — 2026-09-28
- Notes, for thoughts and sermons: open the bookmark icon › Notes › "+ New". Notes sit between Lists and ChatGPT, fold away, and can be dragged into order.
  - Dictate, like Live Transcribe: tap "Dictate" and talk. The words being heard show live under the note and settle into it as you go; on Android it keeps listening until you tap again. Say "new paragraph", "new line", "period", "comma" or "question mark".
  - Insert: bring a list (its verses written out with references) or a ChatGPT chat into the note, where the cursor is.
  - Share sends the note by text or email.
  - Notes are saved on the device as you type. The search box is hidden while a note is open, to keep the page to your writing.

## v1.31.0 — 2026-09-28
- Add surrounding verses to a list, beside the verse: open a verse from a list, tap the verses around it on the chapter page, then tap "Add around 36:5". They go into the list right next to it in Bible order, so playing or repeating the list plays them together (Psalm 36:4-7, then the next verse). Verses already in the list are marked with a line at the left and aren't added twice. For a search, save it to a list first ("Save to “faithfulness”").

## v1.30.1 — 2026-09-28
- Undid v1.30.0: the "1v / 3v / 5v" button is gone, and search results and lists play just their own verses again, as in v1.29.0.

## v1.29.0 — 2026-09-28
- Repeat keeps going all night, on lists, searches and chapters:
  - The screen stays awake while reading (your phone's own dimming still applies). Plug the phone in overnight.
  - Pressing the side button to turn the screen off no longer stops reading. The Heart voice keeps moving from verse to verse with the screen off, and a silent sound keeps the page awake for your phone's own voice.
  - If the internet drops while the Heart voice moves to the next chapter, it tries again a few times instead of switching to the phone's voice.
  - If reading ever stalls (Chrome sometimes loses a spoken phrase), it picks up again from the same verse within about 45 seconds.
  - Reading shows on the lock screen and in notifications ("John 11:35 · Voice Bible"), with pause/stop.

## v1.28.0 — 2026-09-28
- Share verses by text or email: select verses (on a chapter, in search results or in a list) and tap "Share". Your phone's share menu opens (Messages, Gmail, WhatsApp …) with the verses and their references, like "John 3:16-17 (KJV)". Verses that follow each other are grouped and numbered. On a computer without a share menu, the verses are copied to paste into a message.

## v1.27.0 — 2026-09-28
- Spanish: pick "RV1909" (Reina-Valera 1909) in the translation menu. It's the public-domain Reina-Valera; the 1960 revision is still under copyright.
  - Book names show in Spanish (Génesis, Juan, Salmos…), and references like "Juan 3:16", "Salmo 23" or "Apocalipsis 21:1 al 4" open directly.
  - Search ignores accents: "corazon" finds "corazón".
  - Reading aloud uses a Spanish voice on your device and says "Salmos 23, versículo 1". The voice you pick for Spanish is remembered separately from your English one. (The Heart recordings are English, so they're used only for English.)
  - Voice search listens in Spanish while RV1909 is chosen.
  - Word study works in Spanish too: tap a word to see the Hebrew or Greek behind it, where it's used, and how the Reina-Valera translates it.

## v1.26.0 — 2026-09-28
- Lists fold up too: tap "▾ Lists" to close or open them, remembered on each device. When you're saving verses, your lists always show so you can pick one.
- ChatGPT now comes below Lists.

## v1.25.0 — 2026-09-28
- Drag your ChatGPT chats into order, like lists: press and hold the ⠿ handle and move the chat up or down.
- Chats now stay where you put them. Continuing a chat no longer jumps it to the top; new and imported chats are added at the top.

## v1.24.1 — 2026-09-28
- The ChatGPT section in Lists folds up: closed, it's one line ("▸ ChatGPT 24" with a "+ New" button), so your lists come first. Tap it to show your chats and "Import from ChatGPT". Open or closed is remembered on each device, and it starts closed.

## v1.24.0 — 2026-09-28
- Bring chats over from ChatGPT: open the bookmark icon › Lists › "⇩ Import from ChatGPT".
  - Best way: in ChatGPT go to Settings › Data controls › Export data, download the .zip from the email, and choose it here. Pick the chats you want (there's a search box), and they appear under ChatGPT with every message, ready to continue.
  - Quick way: "Or paste one conversation". Turns marked "You said:" and "ChatGPT said:" are kept apart.
  - Chats already brought over are marked "already here", so importing again never overwrites what you've added since.
- Very long chats send only their most recent messages to ChatGPT, to keep answers quick and cheap.
- The app title stays on one line on small phones.

## v1.23.0 — 2026-09-28
- Word study shows how the KJV translates a word: under "Where it’s used", "Translated as" lists every English word or phrase used for it, with how many times, most used first (for G25: love 51 · loved 29 · loveth 20 · beloved 7 …). Tap one to see just those verses.
- A capital from starting a sentence or a quote is counted with the lowercase word ("Love your enemies" counts as "love"), while "God" and "god" stay separate.

## v1.22.0 — 2026-09-28
- Word study shows where a word is used: at the bottom of the panel, "Where it’s used" lists each book with how many verses use the word (Matt 7 · John 27 · 1 John 17 …). Tap a book to see just those passages, with the word highlighted.

## v1.21.0 — 2026-09-28
- Word study with KJV + Strong's: pick "KJV+S" in the translation menu (top right). Words in a chapter get a faint dotted underline; tap one to see the Hebrew or Greek word behind it, how to say it, Strong's definition, how the KJV translates it, and the root word it comes from (tap to follow it).
- "Every verse with H430" in that panel lists every verse that uses the same Hebrew or Greek word, with those words highlighted. You can also type a Strong's number like H430 or G26 in the search box; in plain KJV the app switches to KJV+S for it.
- The translation you pick is now remembered.
- Text: KJV with Strong's numbers from eBible.org and CrossWire (public domain). Dictionary: Strong's (1894) from Open Scriptures (CC BY-SA).

## v1.20.2 — 2026-09-28
- "All words / Exact phrase" now always shows under the search box, with the one in use highlighted, instead of only popping up when you tap in the box.

## v1.20.1 — 2026-09-28
- The "Saved 143 to “Heaven and earth”" message near the top can now be tapped to open that list ("Open ›"). It stays up a little longer so there's time to tap it.
- Searching now puts the keyboard away, so the results (and the Back button) aren't covered.

## v1.20.0 — 2026-09-28
- Reorder your lists: in Lists, press and hold the ⠿ handle at the left of a list and drag it up or down. The new order is saved on that device.

## v1.19.1 — 2026-09-28
- Lists is now the left tab and opens first; History is on the right.

## v1.19.0 — 2026-09-28
- ChatGPT: open the bookmark icon › Lists. A new "ChatGPT" section at the top has "+ New chat" and your saved conversations. Ask anything about the Bible; answers appear as they're written, and verse references in them (like Romans 8:28) open when tapped.
- Uses your own OpenAI API key, entered the first time you start a chat. It's saved only on that device and sent only to OpenAI, never to this website. Change or remove it with "API key" in a chat. The model can be changed there too (default gpt-5-mini).
- While a chat is open, what you say into the mic goes into the chat box instead of starting a search.
- Deleting a chat asks first, like lists.

## v1.18.2 — 2026-09-28
- Deleting a list now asks first, right in the list: tapping ✕ shows "Delete “John”?" with Delete and Cancel buttons. The ✕ also sits further from the ✎ rename button so it's harder to hit by mistake.

## v1.18.1 — 2026-09-28
- Fix: with the Heart voice, playing search results or lists (verses that don't follow each other) sometimes ran past the end of a verse and caught the start of the next verse's first word. Each verse now stops cleanly in the pause after its last word.

## v1.18.0 — 2026-09-27
- iPad, iPhone and Mac Safari: fewer microphone prompts. Safari can ask for the microphone every time listening starts, and the app used to restart listening on its own (after a pause, after reading aloud, and when you came back to the tab). On Apple devices the mic now listens only when you tap it: tap, say a word or verse, and it stops until the next tap.
- To stop the prompts entirely on an iPad or iPhone: in Safari tap aA (left of the address) › Website Settings › Microphone › Allow.
- Android and computers keep listening on their own as before.

## v1.17.0 — 2026-09-27
- Copy verses from one list to another: in a list, select verses (or tap "Select all") and tap "Copy to list…", then pick another list or name a new one. The verses stay in the original list too, and "Remove" still takes them out.

## v1.16.0 — 2026-09-27
- Trying out: tap in the search box and a small pop-up offers "All words" (every verse with all your words, in any order, exact phrases first) or "Exact phrase" (only the words together, as typed). Switching redoes the search on screen, and your choice is remembered.

## v1.15.0 — 2026-09-27
- Follow along word by word: while a verse is read aloud, the word being spoken is highlighted, on chapter pages, search results and lists.
- Device voices that report each word (such as Chrome on a computer) highlight exactly. For the Heart voice and other phone voices, the app times the words from the length of each word and the pauses at commas and full stops, and it learns the voice's pace as it goes.

## v1.14.0 — 2026-09-27
- Share a list: in Lists, tap the share icon next to a list to send it as a link by text, email or any app. Opening the link on another phone or computer asks "Add list?". If you already have a list with that name, the verses are added to it.
- ← Back now appears on every screen that has somewhere to go back to: search results, lists and chapters. It returns you to the same spot, even far down a long search.
- Your phone's back gesture now steps back through the app's screens instead of leaving the app.

## v1.13.0 — 2026-09-27
- Searching several words also finds verses that have all of them apart or in a different order. For example, "principalities powers" now finds Ephesians 6:12 ("against principalities, against powers"). Exact-phrase matches still come first, and the others follow under "Also: verses with all these words", with each word highlighted.

## v1.12.0 — 2026-09-27
- Go to any verse with scroll wheels: tap the 📖 button next to Search, spin Book, Chapter and Verse, then tap "Open". Choose "All" in Verse for the whole chapter.
- On a chapter page, tap the chapter's title to open the wheels at that spot.
- Places you open this way are added to your search history.

## v1.11.0 — 2026-09-27
- One chapter at a time again: each chapter ends at the bottom, and the next one doesn't load as you scroll.
- Swipe left for the next chapter, right for the previous one, with a quick slide so you can see it turn. Swipes now work even when the phone's browser starts treating them as a scroll. The ← / → chapter buttons are back at the bottom too.
- Playing a chapter still reads on into the next ones, and the page turns with it.
- "New version — tap to update": the app now notices when an update is live and offers a one-tap reload, so phones don't get stuck on an old copy.

## v1.10.0 — 2026-09-27
- Keep reading past the end of a chapter: scroll down and the next chapter appears, on and on. "↑ Genesis 3" at the top adds the chapter before.
- Swipe left for the next chapter, right for the previous one. Swipes starting at the very edge of the screen are left to your phone's back gesture.
- "▶ Play chapter" and "▶ Whole chapter" keep reading into the following chapters, and the page follows along. Turn on Repeat to loop just the one chapter instead.
- The play button names the chapter you've scrolled to, like "▶ Play Genesis 5".

## v1.9.1 — 2026-09-27
- "Select all" moved to the play bar at the bottom of the screen, so it's always in reach, even far down a long search like "God". Once verses are selected, "Save to “God”", "Other list…", "All" and "Clear" appear in the same bar.

## v1.9.0 — 2026-09-27
- "Select all" on search results and saved lists: one tap checks every verse, even ones further down the page.
- One-tap save: after a search like "John", "Save to “John”" puts the selected verses in a list called John, creating it the first time and adding to it after that. "Other list…" still lets you pick or name a different list.
- The natural voice now sounds brighter and clearer. Chapters are being re-recorded and swap in as they finish.

## v1.8.0 — 2026-09-26
- Natural voice: pick "Heart" under Natural voices in the voice picker to hear the Bible read by a recorded voice that sounds human. It streams over the internet.
- Books are being added as they're recorded. Obadiah is ready now, with John, Ephesians and Revelation next. Chapters that aren't recorded yet are read with the device voice.
- Speed changes take effect right away with the natural voice.

## v1.7.0 — 2026-09-25
- Pick verses on the chapter page: tap any verses (for example 1, 5, 8 and 16) to outline them with a ✓, then tap "▶ Play 4" to hear just those, in chapter order. Tap a verse again to unselect it.
- Save picked verses to a list, or clear them, from the bar that appears above the play buttons.
- Your picks clear when you move to another chapter or go back.

## v1.6.0 — 2026-09-25
- Play from the chapter page: after opening a verse like John 3:16, choose "▶ Play 3:16" for just that verse (or range, like 3:16-18) or "▶ Whole chapter". Opening a whole chapter (like Psalm 23) shows "▶ Play chapter".
- The verse being read is highlighted and the page scrolls along with it.
- Repeat, Refs and speed work on the chapter page too. Reading stops when you move to another chapter.

## v1.5.1 — 2026-09-25
- Fix: voice picker said "No English voices found" on phones that load their voices late. The app now keeps checking for a few seconds and again whenever the picker opens.
- If no voices are marked English, all voices are shown instead of none.
- If the browser never shares its voices, the picker explains that it reads with the device's default voice.

## v1.5.0 — 2026-09-25
- Choose the reading voice: tap the speaker icon at the top to see your device's English voices, labeled man or woman and by accent (American, British, Australian, Indian, Irish, South African and more). Tap ▶ to hear a sample. Remembered on your device.
- Changing the voice while reading restarts the current verse in the new voice.
- Tips for downloading more voices on iPhone and Android.

## v1.4.0 — 2026-09-25
- History: the bookmark icon at the top opens your recent searches; tap one to run it again, ✕ to remove it, or clear them all.
- Saved lists: check verses, tap "Save to list", then pick a list or name a new one. Open a list from the bookmark icon's Lists tab to read or play it; check verses there to remove them. Rename (✎) or delete (✕) lists from the Lists tab.
- History and lists are kept on this device.
- Repeat button is now just ⟳ so the Play button has room on phones.

## v1.3.0 — 2026-09-25
- Speed button in the player: tap to cycle 0.5× · 0.75× · 1× · 1.25× · 1.5× · 2×. Changing it while reading restarts the current verse at the new speed. Remembered on your device.

## v1.2.0 — 2026-09-25
- "Refs" button in the player (purple = on): turn off reading the book, chapter and verse so only the words are read. Remembered on your device.

## v1.1.0 — 2026-09-25
- Read verses aloud: play a single verse, all results, or only the verses you select.
- Repeat toggle loops the chosen verses.
- The microphone pauses while reading so it doesn't hear itself, then resumes.
- Version number shown at the bottom of the app.

## v1.0.0 — 2026-09-25
- First release: KJV Bible with voice search that starts listening on page load.
- Say or type a word or phrase to find every verse containing it, with highlights.
- Say or type a reference ("John 3:16", "Psalm 23", "first John four eight") to open it.
- Purple and black mobile design; installable to the home screen.
