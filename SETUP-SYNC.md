# Set up sync (Google sign-in + Supabase)

This takes about 15 minutes, once. After that, your words are the same on your phone and your computer.

You will use three websites: **Supabase** (stores your words), **Google Cloud** (lets you sign in with Google) and **Vercel** (hosts Lexi). All free for an app this size.

Menu names on these sites change from time to time. If a name below doesn't match exactly, look for the closest one.

Keep a notes file open. You will copy 4 values along the way:

| Value | Where it comes from |
|---|---|
| Supabase Project URL | Step 3 |
| Supabase anon (publishable) key | Step 3 |
| Google Client ID | Step 4 |
| Google Client secret | Step 4 |

---

## Step 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (signing up with GitHub is quickest).
2. Click **New project**.
   - **Name:** `lexi`
   - **Database password:** click Generate and save it in your notes. You won't need it for Lexi, but keep it.
   - **Region:** Southeast Asia (Singapore), the closest to Vietnam.
3. Click **Create new project** and wait 1 to 2 minutes until it is ready.

## Step 2. Create the table and the security rules

1. Open `supabase/setup.sql` from the Lexi folder.
2. Check the email near the top. It must be the **Google account you will sign in with**:
   ```sql
   'thisisdat098@gmail.com'
   ```
   Change it if you use another Google account.
3. In Supabase, open **SQL Editor** (left menu), click **New query**, paste the whole file, and click **Run**.
4. You should see **Success. No rows returned**.

This creates one table for your words and turns on the rules: each person can only see their own words, and only the email in that list can use the table at all.

## Step 3. Copy the Supabase URL and key

1. In Supabase, open **Project Settings** (gear icon), then **API** (or **Data API** / **API Keys**).
2. Copy into your notes:
   - **Project URL**, like `https://abcdefgh.supabase.co`
   - **anon public** key (newer projects call it **publishable** key, starting with `sb_publishable_`)

> Never copy the **service_role** or **secret** key into Lexi. That one can bypass every rule.

3. Open **Authentication** > **Sign In / Providers** > **Google** and copy the **Callback URL** shown there. It looks like `https://abcdefgh.supabase.co/auth/v1/callback`. You need it in the next step. Leave this page open.

## Step 4. Create the Google sign-in (Google Cloud)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in with your Google account.
2. At the top, click the project picker, then **New project**. Name it `Lexi` and click **Create**. Make sure `Lexi` is selected afterwards.
3. Open **APIs & Services** > **OAuth consent screen** (may be called **Google Auth Platform**). Click **Get started**:
   - **App name:** `Lexi`
   - **User support email:** your email
   - **Audience:** **External**
   - **Contact email:** your email
   - Agree and click **Create**.
4. Open **Audience** and, under **Test users**, click **Add users** and add your Gmail address. While the app is in "Testing", only test users can sign in, which is exactly what you want.
5. Open **Clients** (or **Credentials**) > **Create client** (or **Create credentials** > **OAuth client ID**):
   - **Application type:** Web application
   - **Name:** `Lexi web`
   - **Authorized JavaScript origins:** add
     - `https://lexi98.vercel.app`
     - `http://localhost:5173`
   - **Authorized redirect URIs:** add the **Callback URL** from Step 3 (`https://…supabase.co/auth/v1/callback`)
   - Click **Create**.
6. Copy the **Client ID** and **Client secret** into your notes.

## Step 5. Turn on Google in Supabase

1. Back in Supabase, **Authentication** > **Sign In / Providers** > **Google**.
2. Turn it **on**, paste the **Client ID** and **Client secret**, and click **Save**.
3. Open **Authentication** > **URL Configuration**:
   - **Site URL:** `https://lexi98.vercel.app`
   - **Redirect URLs:** add `https://lexi98.vercel.app` and `http://localhost:5173`
   - Save.

## Step 6. Give Lexi the Supabase URL and key (Vercel)

1. In Vercel, open the `lexi98` project > **Settings** > **Environment Variables**.
2. Add two variables (for all environments):
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon (publishable) key
3. Go to **Deployments**, open the menu on the latest one and click **Redeploy**. The values are built into the app, so a redeploy is needed.

For `npm run dev` on your computer, copy `.env.example` to `.env.local` and fill in the same two values. `.env.local` is in `.gitignore`, so it is never uploaded.

## Step 7. Try it

1. Open `https://lexi98.vercel.app` on your computer. If you see an old version, clear the service worker (DevTools > Application > Service Workers > Unregister) and reload.
2. Go to the **Profile** tab, click **Sign in with Google**, and choose your account. Google may warn that the app is not verified: that's normal for your own app in Testing. Click **Continue**.
3. Back in Lexi, Profile shows your name and **Synced just now**. The words already on this computer are uploaded.
4. On your phone, open the same address, go to **Profile** and sign in. Your words appear.

## Optional: close the door to everyone else

After you have signed in once, open Supabase > **Authentication** > **Sign In / Providers** and turn off **Allow new users to sign up**. Then nobody new can even create an account.

---

## If something goes wrong

| What you see | What to do |
|---|---|
| Google says **redirect_uri_mismatch** | The redirect URI in Google (Step 4.5) must be exactly the Supabase Callback URL. |
| Google says **Access blocked** or you are not a test user | Add your Gmail as a test user (Step 4.4). |
| Back in Lexi but still signed out | Check Site URL and Redirect URLs in Supabase (Step 5.3). |
| Profile: **This Google account is not allowed to sync** | The email in `setup.sql` is not the one you signed in with. Fix it and run the SQL again. |
| Profile: **The database table is missing** | Run `supabase/setup.sql` (Step 2). |
| Profile: **Sync is not set up yet** | The Vercel variables are missing or you didn't redeploy (Step 6). |
| Sign-in on the iPhone home screen app opens Safari and stays there | Sign in from Safari first, or remove the home screen icon, sign in in Safari, then add it again. |

## How sync works

- Words are still saved on each device first, so Lexi works offline.
- When you are signed in, Lexi syncs when it opens, a moment after each change, when you come back to the app, and when the internet returns.
- If the same word changed on two devices, the most recent change wins.
- Removing a word removes it on your other devices too.
- Signing out keeps the words on that device.
