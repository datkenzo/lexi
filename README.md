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

## Turn on AI sentence suggestions (optional)

The "Suggest a sentence" button calls `api/sentence.js`, a small Vercel function that keeps your API key off the phone.

1. In Vercel, open your project, then Settings, then Environment Variables.
2. Add `ANTHROPIC_API_KEY` with your key from the Anthropic Console. Redeploy.
3. Optional: set `ANTHROPIC_MODEL` to use a different model. The default is `claude-haiku-4-5-20251001`.

`npm run dev` does not run the function. To test it on your computer, use `npx vercel dev` instead. Without the key, everything else still works.

## How it behaves

- **Looking up a word saves it.** Each word is stored once with a status: Learned or Not learned.
- **Looking up a saved word again** does not add to Total words. The word goes back to Not learned, even if it was Learned.
- **Review** lets you pick all Not learned words or all words, and a time range: today, this week (from Monday), this month, or custom dates. Time ranges use the date you last looked the word up.
- **Learned words** are skipped in "Not learned" mode. They come back only when you look them up again.
- **Home screen** shows Total words and Not learned.
- **Offline:** saved words and review keep working. New words need internet.
- **Dark mode** follows the phone setting.

## Your data

Words are stored on the device (IndexedDB). There is no login and no sync in version 1, so the iPhone and the browser each have their own list. Clearing Safari website data deletes your words.

## Where things are

- `src/lib/words.js`: the rules (lookup, status, time ranges). Tested in `test/`.
- `src/lib/dictionary.js`: Free Dictionary API. Datamuse suggests spellings when a word is not found.
- `src/lib/db.js`: IndexedDB storage.
- `src/components/`: Search, History and Review screens.
- `src/styles.css`: colors, fonts and spacing from the project brief. Change the `:root` values to restyle the app.
- `api/sentence.js`: the AI sentence function.
