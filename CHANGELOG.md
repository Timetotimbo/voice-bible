# Changelog

Each version is tagged in git and published as a GitHub release. To see or restore an older version, open the repo's Releases page.

## v2.23.1 — 2026-10-08
- The verse pop-up's buttons are smaller and fit on one line: ▶ Listen · ⟳ Loop · 📋 · Chapter · ✎ ("Open chapter" is now just "Chapter").

## v2.23.0 — 2026-10-08
- **Copy buttons for verses.** Select verses in a chapter or in search results and tap **Copy** (next to Share): they're copied with their reference ("John 3:16-17 (KJV)", then each verse) to paste anywhere. And on the verse pop-up from a reference in a note, **📋** copies that verse with its reference (it turns ✓ when done).

## v2.22.1 — 2026-10-08
- **Tidy spacing also joins broken lines.** Text copied from a document often has line breaks in the middle of sentences ("Who Is Capable / Of Greatly Blessing…", "Jonah 3:4- / 10"). Tidy now joins a line to the next when it doesn't finish a sentence, so each point or quotation is one flowing paragraph, and split references are whole again (Jonah 3:4-10, 2 Chronicles 9:22). Numbered points, "~" items and lines ending with . ? ! ) or : stay on their own lines. Undo puts it all back.

## v2.22.0 — 2026-10-08
- **Tidy spacing for notes.** A note with lots of empty lines or pasted gaps (common when copying from Google Docs) shows "This note has lots of empty lines and spaces" with a **Tidy spacing** button: runs of empty lines become one, tabs and extra spaces become single spaces, and stray spaces at the start and end of lines go. The words stay the same, and ↶ Undo puts the old spacing back.

## v2.21.0 — 2026-10-08
- **Loop on the verse pop-up.** Tap a reference in a note, then **⟳ Loop**: ▶ Listen keeps replaying the verse (or verses) until you tap ■ Stop, good for memorizing. It's the same Loop as on the note's play bar, so it's remembered there too.

## v2.20.1 — 2026-10-07
- **A note's buttons follow you down.** In a long note, the toolbar (Dictate, Listen, Insert, camera, undo/redo, find, share) stays at the top of the screen as you scroll, and the find bar sits just under it.

## v2.20.0 — 2026-10-06
- **Combine a backup with what's on this device.** Settings → ⇧ Restore from a backup now asks **Combine with what's here** or **Replace what's here**. Combine keeps everything from both: lists with the same name get every verse from both (no doubles), lists, notes and chats that are on only one device are added, and a note changed on both devices is kept in both versions ("(other copy)"). Settings stay as they are on this device. Afterwards it says what was added.

## v2.19.0 — 2026-10-06
- **Find in a note.** Tap 🔍 in a note's toolbar and type: every match is highlighted, the count shows ("6 of 24"), and ▲ ▼ (or Enter) jump between them, scrolling each into view. It ignores capitals and accents, and finds words inside references too. ✕ closes it.

## v2.18.0 — 2026-10-06
- **Fast scroll for long notes.** In a note several pages long, a handle appears on the right edge as you scroll. Drag it to move through the whole note quickly (it shows how far down you are, like 50%), or tap the track to jump there. It fades a moment after you let go.
- Text pasted from Google Docs: its line breaks inside a paragraph used to show as a small box. They're now normal new lines.

## v2.17.3 — 2026-10-06
- **Fixed: underlines drifting in long notes** (for example several pages pasted from Google Docs). Notes are now shown as text with the references as real links while you're not typing, so the links always sit on their words. **Tap anywhere in the text to type**: the text box opens with the cursor right where you tapped. Tap outside the note (or close the keyboard) and the links come back.

## v2.17.2 — 2026-10-06
- The verse card from a note's reference **stays open while it reads**: ▶ Listen turns into ■ Stop, and the verse being read is highlighted in the card.

## v2.17.1 — 2026-10-06
- **Fixed: tapping a reference in a note stopped working.** After you'd tapped into the note to type, the underlines switched off and stayed off (on Android the note stays in typing mode after the keyboard closes). Now they pause only while you're actually typing and work again a moment after you stop.
- **Fixed: underlines out of line.** A reference that wraps onto two lines (like "Proverbs 19:2") was moved whole to the next line in the tap layer, so everything below was a line off. They now wrap with the text.
- ✎ on a verse card puts the cursor right after that reference, to change it.

## v2.17.0 — 2026-10-06
- **Bible references in notes pop up their verses**, like Blue Letter Bible. Paste or type references such as "(Proverbs 11:14)", "Philemon 1:9-10", "Genesis 29:27-28; Proverbs 19:2" or "Rom 8:28,31" and they're underlined. Tap one (or point at it with a mouse on a computer) and a card shows the verses in your translation, with **▶ Listen** and **Open chapter**.
- The note is still edited as usual: tap anywhere else in it to type. While you're typing, the underlines dim and don't respond, so tapping places the cursor even on a reference.
- They also work while a note is being read aloud.

## v2.16.1 — 2026-10-06
- **Fixed: Heart stalling on chapters and verse lists.** Since v2.15.0 the Heart recordings were blocked from loading (a side effect of the change that makes Heart for notes faster), so reading paused on the first verse, retried, then switched to the phone's voice. They load again, and reading carries on verse after verse and into the next chapter.

## v2.16.0 — 2026-10-06
- **Verse notifications.** Settings → **Verse notifications**: a Bible verse on your lock screen on a timer, every hour by default (or every 30 minutes, 2, 3, 4, 6 or 12 hours, or once a day). **Quiet hours** (10 PM to 7 AM to start with, or your own times) keep the night free. Verses come from well-known **popular verses**, **anywhere in the Bible**, or one of **your verse lists**. Tap a notification to open that verse in the app. "Send one now" tries it straight away.
- On iPhone, add Voice Bible to the home screen first; notifications from websites only work from there.
- A link like voicebible.eefavorbooks.com/?ref=John+3:16 opens that verse.

## v2.15.0 — 2026-10-05
- **Heart reads your notes, and keeps going when you leave the app.** Settings → Reading voice → **Heart for notes** → Download (about 160 MB, once). After that, with Heart as your reading voice, notes and chats are read in Heart's own voice, made on the phone, as real audio: they keep playing with the screen off or another app open, like Bible chapters, and work offline. A long paragraph may take a moment to start. "Remove Heart for notes" frees the space; without it, notes are read by the phone's voice as before.
- The app now runs "cross-origin isolated" (set by its offline helper), which lets Heart use several of the phone's cores: about 2.5 times faster.

## v2.14.0 — 2026-10-05
- **Notes can be read without the Bible references.** While a note (or a chat) is being read, the play bar has a new **Refs** button. Turned off, it skips references like "John 3:16 (KJV)", "(Rom 8:28)" or "— Psalm 23:1 NIV" and the verse numbers in front of each line of an inserted passage, and reads just the words. It's the same setting as "Say the reference first" for chapters.

## v2.13.0 — 2026-10-04
- **Drag notes to reorder them** right away: each note in the Notes tab has its ⠿ handle showing (no need to tap Edit first). The same for your verse lists in the Verse Lists tab and your chats in Chat. Deleting still needs Edit, so nothing is removed by accident.

## v2.12.0 — 2026-10-04
- **Heart (the Natural voice) offline.** Settings → Reading voice → **Heart offline**: save a book (pick it from the list), the New Testament (about 440 MB) or the whole Bible (about 1.9 GB) on the phone, with a progress bar. Stop any time and carry on later; it picks up where it left off. Saved chapters play with no internet, starting at any verse, with "Say the reference first" too.
- Chapters you play on Wi-Fi are kept for offline as well (not on mobile data).
- Offline, a chapter that isn't saved switches to the phone's own voice straight away (it used to wait about 20 seconds trying the connection).
- "Remove saved recordings" frees the space again.

## v2.11.0 — 2026-10-04
- **Works offline.** The first time Voice Bible opens with a connection, it saves itself and the Bible text on the phone (KJV, KJV with Strong's numbers, Reina-Valera 1909 and the Strong's dictionary, about 6 MB to download), plus its fonts. After that, away from Wi-Fi or with no signal, it opens and you can type to search (words, phrases or references like John 3:16), read chapters, use your verse lists and notes, and have verses read aloud with the phone's own voices.
- Needs the internet still: the mic (voice search), the Natural voices, and Chat. When offline, a note under the search box says so.
- Updates still arrive: with a connection it always loads the newest version.

## v2.10.0 — 2026-10-04
- **Reorder the verses in a verse list.** Open a list and drag a verse by its ⠿ handle (on the right of the card) up or down; the others slide aside, and the new order is kept. Playing the list reads them in that order. With a keyboard, focus the handle and use the arrow keys. (The handles hide while you're choosing verses.)

## v2.9.0 — 2026-10-03
- Words + face: **move your face**. Tap the small preview to make it bigger, then drag your face anywhere and use − / + to make it smaller or bigger. The words make room: above your face when it's low, below it when it's high (the title moves too). Your spot is remembered.
- The verse you're on now has a **pink highlight band** behind it and the other verses are dimmer, so it's easy to see even in the small preview.
- The top line of a chapter is no longer faded when you first open it; the soft edge only shows once you've scrolled.
- The floating recorder's preview can be tapped to make it bigger too.

## v2.8.0 — 2026-10-03
- Browse while recording, in **Words + face**: the video now shows **the page**, not one verse at a time. The verses on your screen flow on with their numbers, like the chapter page, and **scroll in the video as you scroll**. The verse at the reading line (or the one being read aloud) is bright white, the rest a little dimmer, with the chapter (like John 3) at the top.
- Prefer the old way? Teleprompter settings (⚙) → "While browsing, the video shows" → "One verse at a time, big".

## v2.7.0 — 2026-10-03
- Keep recording while you use the rest of the app. While the teleprompter records, tap **Browse while recording**: it shrinks to a small floating recorder (a preview, the time, ■ Stop and ⤢ back to the teleprompter), and you can go to a chapter, search, open notes and lists, and the recording carries on.
- In **Words + face**, the video follows what you're reading: the verse at the reading line (a third of the way down the screen), or the verse being read aloud, with its reference (like John 3:16) at the top. Hints and menus are skipped.
- The teleprompter now opens over the whole app instead of inside the note, so leaving the note doesn't end a recording.

## v2.6.0 — 2026-10-03
- Teleprompter: **Words + face**, on phones and computers. The video is tall (for Shorts, Reels and TikTok) and shows the words you're reading, large and clean, with your face in a glowing circle under them and your voice.
  - The words follow the ▶ line as the text scrolls: each paragraph shows on its own, and long ones are split into pieces of about 40 words at the ends of sentences.
  - A small preview on the right shows what the video looks like.
  - To show Bible verses, put them in a note first (Insert into a note), then open the teleprompter from that note.
- The teleprompter's top now has Camera · Words + face (· Screen + face on computers).

## v2.5.0 — 2026-10-03
- Teleprompter: **Screen + face** (on a computer, in Chrome or Edge). Record your screen, a window or a browser tab with your camera in a round bubble in a corner, plus your voice (and the computer's sound if you tick "share audio").
  - Choose the bubble's corner and size in the teleprompter settings (⚙).
  - While recording, a small window with your camera and a Stop button floats above everything, so you can stop without coming back to Voice Bible. You can also stop with the browser's "Stop sharing" bar.
  - Phones and tablets can't share their screen from a browser, so the button only shows on computers.

## v2.4.1 — 2026-10-02
- A new app icon for the home screen: an open Bible with sound rising from it, as a glowing neon sign (magenta into cyan on deep navy). It's also made in the shape Android expects, so it fills the icon instead of sitting small on a white circle. Phones show it the next time Voice Bible is added to the home screen.

## v2.4.0 — 2026-10-01
- ClipForge now lives inside Voice Bible, at voicebible.eefavorbooks.com/clipforge/. They're still two apps, but on one address they can share things:
  - Send to ClipForge (after a teleprompter recording) opens ClipForge in the same window with the video already in it. There's no new tab or pop-up, and it works when Voice Bible is installed on the home screen (iPhone, iPad and Android).
  - ClipForge uses the ChatGPT key you gave Voice Bible, so one key does both.
  - "← Voice Bible" in ClipForge's top bar goes back.
- clipforge.eefavorbooks.com still works. The first time you open ClipForge inside Voice Bible, "Bring over my templates, palettes and projects" copies everything from the old address in one step.

## v2.3.0 — 2026-10-01
- Insert into a note: after finding verses by words (e.g. "God is good"), tap a verse to open its chapter, with that verse already chosen and in view. Tick any verses around it, then Insert, or go "← Back to results" to choose more. Tapping a result's box still chooses it without opening the chapter.
- Your choices are kept while moving between the results, a chapter and new searches, and they're inserted together in Bible order (e.g. "Psalms 73:1-3").

## v2.2.1 — 2026-10-01
- Fix: teleprompter videos showed the wrong length in the phone's Photos/Gallery app (a 12-second video said 3 seconds). Phone browsers record MP4 in many small pieces without writing the total length. After recording, Voice Bible now copies the picture and sound, unchanged and with no loss of quality, into a normal MP4 with the right length. You'll see "Preparing the video…" for a moment. If a phone records in a format this can't handle, the video is kept as it was.

## v2.2.0 — 2026-10-01
- Send to ClipForge: after recording with the teleprompter, "Send to ClipForge" opens ClipForge in a new tab with the video already in it, ready for captions, word animations and auto-reframe. The video goes only to ClipForge's own address. If the browser blocks the new tab, or ClipForge doesn't answer, it tells you to save the video and upload it there instead.

## v2.1.0 — 2026-10-01
- Teleprompter in Notes: the camera button in a note's toolbar opens the camera full screen, with the note scrolling at the top, close to the lens, so you can read it while looking at the camera.
  - Speed in words a minute (60–260), with − and + or the slider. It can be changed while recording, and the screen shows about how long the note takes at that speed.
  - Tap the text to pause or carry on; drag it to go back or ahead. ▶ scrolls it to practise without recording; ⤒ goes back to the top.
  - ● records with a 3-2-1 countdown (it can be turned off) and a running timer. The words on screen aren't in the video. ⟲ switches between the front and back cameras.
  - ⚙ has text size, the countdown, and mirrored text for a teleprompter glass.
  - After recording, watch the take, then Share it (to TikTok, Instagram, YouTube, WhatsApp and other apps on the phone), Save video, or Record again. Closing asks first if the video hasn't been saved or shared.
  - Records MP4 where the browser can (Chrome on Android, Safari on iPhone), else WebM. The screen stays on while it's open. Works in both layouts and in Spanish.

## v2.0.0 — 2026-09-30
A new look, built from the Neon Book design (mockup Option E):
- The app opens on the chapter you last read, set like an open book: the book's name, a big chapter number, and the verses running together in a reading font (Spectral). "Go to ▾" picks another place.
- Tabs along the bottom: Read · Search · Verse Lists · Notes · Chat. Each tab comes back to where you left it; tapping the tab you're on goes to its first page.
- The search bar, with the mic inside it, is at the top of every screen. The Search tab has All words / Exact phrase and your recent searches.
- In a chapter, tap verses to choose them. In search results and lists, tap a verse to open it in its chapter, or tap its circle to choose it (once one is chosen, tapping others chooses them too).
- Verse Lists, Notes and ChatGPT each have their own page. Edit shows the drag handles, rename and delete.
- ⚙ Settings holds Reading voice, Colours, Hints, Share Voice Bible, Backup and the version.
- The play bar has ⟳ repeat, speed, and ⋯ for "Say the reference first".
- Classic layout: ⚙ Settings › Classic layout brings back the look from before (v1.49): the big mic, the icons along the top, the bookmark menu, and ▶ / ○ on each verse. It has a ⚙ where the share icon was, to switch back. Both layouts share everything; the choice is remembered on each phone.
- New Neon Book colours (magenta and cyan) are the default for new phones. All the other themes still work, and Spanish still works with the Reina-Valera.

## v1.49.1 — 2026-09-29
- Turning Hints off also hides the "Voice Bible v…" version line at the bottom of the page.

## v1.49.0 — 2026-09-29
- A Hints switch under the Voice Bible title ("Ayudas" in Spanish). Turn it off to hide the instructions: the mic's "Tap the mic…" and "Listening…", the front page's "Say a word or phrase…", and the chapter page's "Tap a word… Swipe left or right…". What the mic hears, and problems like a blocked microphone, still show. It's remembered on each device.

## v1.48.0 — 2026-09-29
- En español: with the Reina-Valera (RV1909) chosen, the whole app is in Spanish. That covers the front page, microphone messages, search, buttons, the play bar, Verse Lists, Notes, ChatGPT, History, Backup, colours, voices, word study, Go to, import and messages. The name stays Voice Bible. Switching back to KJV puts it back in English.
- Dictating a note in Spanish understands "punto", "coma", "punto y coma", "dos puntos", "nuevo párrafo", "nueva línea", "punto y aparte", "signo de interrogación" and "signo de exclamación".
- ChatGPT answers in Spanish and quotes the Reina-Valera when RV1909 is chosen. Spanish references in answers ("Romanos 8:28", "Salmo 23", "Éxodo 3:14") open when tapped.
- Fix: about 3,600 places in the Reina-Valera showed raw marks like {díjole|strong="G2036"} in place of the word. They now read normally, and the words can be tapped for the word study. Those long marks had also made search results wider than the screen.
- Search results can no longer be pushed wider than the screen by a long word.

## v1.47.0 — 2026-09-29
- Rename a Verse List from inside it: tap its name at the top of the list and type, like a note's title. It saves as you type. Clearing it and tapping away puts the old name back, since a list needs a name.

## v1.46.0 — 2026-09-29
- Two more neon themes: Neon Purple and Neon Blue (a deep, true blue; Electric Blue is the bright cyan one).
- The colour picker puts all seven neon themes together under a "Neon" heading, below the others.

## v1.45.1 — 2026-09-29
- Folding sections are back: Verse Lists, Notes and ChatGPT show together again, each folds with ▾/▸, and whole sections drag into order by their ⠿ handle, as before v1.45.0.
- The four buttons along the top stay: tap Verse Lists, Notes or ChatGPT to open that section and jump to it; History shows your searches. The row stays in view as you scroll, and the sheet opens where you left it.

## v1.45.0 — 2026-09-29
- The bookmark sheet has four tabs across the top: Verse Lists, Notes, ChatGPT and History. Each shows just its own items, with how many there are and "+ New". It opens on the tab you used last. Import from ChatGPT is on the ChatGPT tab, and Backup is at the bottom of Verse Lists.
- With tabs, the folding sections and dragging whole sections into order are gone. Lists, notes and chats can still be dragged into order within their tab.

## v1.44.0 — 2026-09-29
- Five neon themes in the palette: Neon Pink, Neon Green, Electric Blue, Neon Orange and Synthwave (hot pink and cyan). Near-black backgrounds with a glowing line along the top, glowing titles, icons and verse numbers, a glowing ring for the mic, and glowing Play and Search buttons.

## v1.43.0 — 2026-09-29
- Send verses to a note: tick verses in a Verse List, in search results or on a chapter page, then tap "To note…" and pick a note or "+ New note". They're added to the end of the note, written out with references, the same as Insert does from inside a note. A new note is named after the list, the search or the chapter. The message that follows opens the note.
- "Lists" is now called "Verse Lists" (the bookmark sheet's tab and section, and Insert in a note).

## v1.42.0 — 2026-09-29
- Share Voice Bible: the new share icon at the top (after the bookmark) opens your phone's share menu with the app's link, https://voicebible.eefavorbooks.com, to send by text, email or any app. It works from the home-screen app too. On a computer without a share menu it copies the link.
- The translation menu at the top is slimmer on phones, so everything still fits on one line.

## v1.41.1 — 2026-09-29
- New address: **https://voicebible.eefavorbooks.com**. The old one (timetotimbo.github.io/voice-bible) takes you there. Your lists, notes and chats stay with the old address, so bring them over with Backup › "Restore from a backup", and add the app to your home screen again from the new address. The Heart voice plays there too.

## v1.41.0 — 2026-09-29
- Backup and restore: open the bookmark icon › Lists and scroll to the bottom. "Save a backup" downloads one file with all your lists, notes, ChatGPT chats, the ChatGPT key and settings. "Restore from a backup" brings them back, on another phone or at a new web address, where the app starts out empty. It shows what's in the file and asks before replacing anything.

## v1.40.0 — 2026-09-29
- Dictate where your cursor is: tap into the middle of a note, then Dictate, and the words go there instead of at the end. Each phrase follows the last, and the cursor moves along after them. A note you haven't tapped into still fills from the end, as before.
- Listen reads from the paragraph your cursor is in. With the cursor at the end (or not placed), it reads from the top.

## v1.39.0 — 2026-09-29
- Listen to notes and ChatGPT chats, like Speechify: tap the speaker button (in a note's toolbar, or at the top of a chat). It reads the note paragraph by paragraph, or the chat message by message, with each word lit up as it's said.
  - Tap any paragraph or message while it's reading to jump there.
  - ⟳ Loop starts again from the top when it reaches the end, for as long as you like (it keeps going with the screen off, like the Bible reading). Tap the speed button for 0.5× to 2×.
  - Stop, or the speaker button again, returns to editing. Dictating stops the reading so the mic doesn't hear it.
  - It uses your phone's voice (the Heart recordings are of the Bible only). Symbols like ** and # in ChatGPT answers aren't read out, and references like “Isaiah 41:10” are read without a break in the middle.

## v1.38.0 — 2026-09-29
- Undo and Redo in notes: ↶ and ↷ in the note toolbar. An insert (a ChatGPT chat, a list, verses) comes back out in one tap; each dictated phrase is a step; typing is undone a burst at a time, not letter by letter. Redo puts back what you undid until you change something new. Ctrl+Z / Ctrl+Y work on a computer. The history lasts while the app is open, even after leaving and coming back to a note.
- The note's Share button is now a share icon, to leave room for the others.

## v1.37.0 — 2026-09-29
- Add a word study to a note: in the Strong's panel (KJV+S or RV1909, tap a word), tap "Add to note" and pick a note or "+ New note". It adds the word, the verse you tapped it in, the Hebrew or Greek word and how to say it, its meaning, how the KJV translates it, its root, the books it's used in, and how it's translated, to the end of the note. The message that follows opens the note.

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
