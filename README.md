# Lexi

A personal app to look up English words, save them, write your own example sentences, and review them with flashcards. Version 1. It works on iPhone (as a PWA) and in the browser.

## Run it on your computer

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the address shown in the terminal. With `--host`, it also shows a network address you can open on your iPhone (same Wi-Fi).

Other commands:

- `npm run build` builds the app into `dist/`.
- `npm test` runs the logic tests. `npm run test:ui` runs the screen flow tests.

## Put it on your iPhone

1. Deploy it (free): push this folder to GitHub, then import it on [vercel.com](https://vercel.com). Vercel detects Vite, no settings needed. Or run `npx vercel` in this folder.
2. Open the Vercel address in **Safari** on your iPhone.
3. Tap Share, then **Add to Home Screen**. Lexi opens full screen like an app.

## How it behaves

- **Looking up a word saves it.** Each word is stored once with a status: Learned or Not learned.
- **Looking up a saved word again** does not add to Total words. The word goes back to Not learned, even if it was Learned.
- **Review** lets you pick all Not learned words or all words, and a time range: today, this week (from Monday), this month, or custom dates. Time ranges use the date you last looked the word up.
- **Learned words** are skipped in "Not learned" mode. They come back only when you look them up again.
- **Home screen** shows Total words and Not learned.
- **Example sentences:** the button shows the example sentences that come with the dictionary entry. Tap Use as draft to copy one into My sentence, then edit it.
- **Offline:** saved words and review keep working. New words need internet.
- **Look:** bright, playful style inspired by Duolingo's UI, light theme only.
- **Pronunciation:** plays the dictionary recording, or the phone reads the word aloud when there is none.

## Your data

Words are saved on each device first (IndexedDB), so Lexi works offline. To use the same words on your phone and computer, sign in with Google in the **Profile** tab. That needs a free Supabase project: follow [SETUP-SYNC.md](SETUP-SYNC.md) once.

Without sync, each device keeps its own list, and clearing Safari website data deletes it.

## Where things are

- `src/lib/words.js`: the rules (lookup, status, time ranges). Tested in `test/`.
- `src/lib/dictionary.js`: looks words up in three free sources in order: Free Dictionary API (through `/dictionary/`, see `vercel.json`), then Datamuse, then Wiktionary. If one is down, the next one answers. Datamuse also suggests spellings.
- `src/lib/db.js`: IndexedDB storage on the device.
- `src/lib/sync.js`, `src/lib/syncLogic.js`: sync with Supabase (most recent change wins).
- `supabase/setup.sql`: the database table and its security rules.
- `src/components/`: Search, History and Review screens.
- `src/styles.css`: colors, fonts and spacing from the project brief. Change the `:root` values to restyle the app.
