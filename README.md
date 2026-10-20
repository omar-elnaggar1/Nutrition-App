# Nutrition Tracker

A simple personal nutrition tracker that runs in your phone's browser.

**Phase 1:** profile & daily targets · manual food logging · "My Foods" one-tap re-logging · daily dashboard with progress bars · data saved on your device.

**Phase 2:** scan nutrition labels with your phone camera (read by Claude, with your API key kept on the server). To switch it on, see [section 7](#7-set-up-label-scanning).

---

## 0. Use it on your phone with GitHub Pages (no computer needed)

GitHub can host the app for free as a website. A workflow file (`.github/workflows/deploy-pages.yml`) republishes it automatically every time the code changes.

**Step A: make the repository public.** Free GitHub Pages only works on public repos, unless you have GitHub Pro. Only the *code* becomes visible. Your food log and profile are stored on your phone and are never uploaded.
1. In your phone's browser (not the GitHub app), open <https://github.com/omar-elnaggar1/Nutrition-App>.
2. Tap **Settings**. If you can't see it, swipe the row of tabs (Code, Issues, …) to the left.
3. Scroll to the very bottom, to **Danger Zone** → **Change visibility** → **Change to public**, and confirm.

**Step B: turn on GitHub Pages.**
1. Still in **Settings**, tap **Pages** in the menu.
2. Under **Build and deployment** → **Source**, choose **GitHub Actions**.

**Step C: publish.**
1. Tap the **Actions** tab → **Publish app to GitHub Pages** → **Run workflow** → **Run workflow**.
2. Wait about 1 minute for the green tick ✅.
3. Open **<https://omar-elnaggar1.github.io/Nutrition-App/>**.

**Step D: add it to your home screen** (see section 2 below), and always open the app from that icon. On iPhone, the home-screen app and a Safari tab keep **separate** data, and the home-screen app's data is the safest from being cleared automatically.

> The GitHub Pages version is just the app's pages. It has no server, so the Phase 2 photo-scanning feature will need a small server hosted somewhere else (GitHub Pages can't keep an API key secret).

## 1. Run it on your computer

You need **Node.js** (the program that runs the server).

1. Go to <https://nodejs.org>, click the big **LTS** download button, and install it (keep clicking *Next*/*Continue*).
2. Open a terminal:
   - **Windows:** press the Windows key, type `cmd`, press Enter.
   - **Mac:** press ⌘ + Space, type `Terminal`, press Enter.
3. Check Node installed — type this and press Enter:
   ```
   node -v
   ```
   You should see something like `v22.x.x` (any version 20.12 or newer works).
4. Download this project. If you have Git installed:
   ```
   git clone https://github.com/omar-elnaggar1/Nutrition-App.git
   cd Nutrition-App
   git checkout claude/nutrition-tracking-app-fu2xs9
   ```
   (No Git? On the GitHub page, switch to the branch above, click the green **Code** button → **Download ZIP**, unzip it, then in the terminal type `cd ` followed by a space, drag the unzipped folder into the terminal window, and press Enter.)
5. Install the libraries the app uses (only needed once, and again after updates):
   ```
   npm install
   ```
6. Start the app:
   ```
   npm start
   ```
   You'll see:
   ```
   Nutrition app running!
     Label scanning: OFF (no ANTHROPIC_API_KEY in .env)
     On this computer:  http://localhost:3000
     On your phone (same Wi-Fi):  http://192.168.1.23:3000
   ```
7. Open `http://localhost:3000` in your computer's browser.

To stop the server, click in the terminal and press **Ctrl + C**.

## 2. Open it on your phone

1. Make sure your phone is on the **same Wi-Fi** as your computer.
2. In your phone's browser, type the "On your phone" address the terminal printed (e.g. `http://192.168.1.23:3000`).
3. If it doesn't load, your computer's firewall may be blocking it. On Windows, click **Allow access** when the "Windows Security Alert" pops up for Node.js.
4. **Add it to your home screen** so it opens like an app:
   - **iPhone (Safari):** tap the Share button (square with an arrow) → **Add to Home Screen**.
   - **Android (Chrome):** tap the ⋮ menu → **Add to Home screen**.

> Your computer has to be on and running `npm start` for your phone to reach it. Later you can put the app online (e.g. on Render or Railway) so it works anywhere.

## 3. Using the app

1. **Profile tab** → enter weight, height, age, sex, activity level and goal → **Save profile**. Your targets and the full calculation appear underneath.
2. **Log tab → Scan Label** → tap **📷 Take photo** (opens the camera) or **🖼️ Choose from gallery**. Claude reads the label and fills in the form below. **Yellow** fields weren't on the label: fix or fill them in. Grams eaten starts at one serving; change it to what you ate, then tap **Log this food**. If the photo didn't work, you'll see why, plus buttons to try again or type the values yourself.
3. **Log tab (manual)** → type the food name, grams eaten, and the **per 100 g** numbers from the label. A preview shows what you actually ate. Leave **Save to My Foods** ticked to save it for next time → **Log this food**.
4. **My Foods tab** → tap **Log** to add your usual amount in one tap. Tap ✎ to log a different amount, or 🗑 to delete.
5. **Today tab** → progress bars for each target. Bars turn red if you go over. Tap ✕ to remove an entry.

## 4. How the targets are calculated

| Step | Formula |
|---|---|
| **BMR** (resting calories, Mifflin-St Jeor) | Men: `10 × kg + 6.25 × cm − 5 × age + 5`<br>Women: `10 × kg + 6.25 × cm − 5 × age − 161` |
| **TDEE** (daily burn) | `BMR × activity factor` — sedentary 1.2 · light 1.375 · moderate 1.55 · very 1.725 · extra 1.9 |
| **Calories** | `TDEE × goal` — lose fat ×0.80 · maintain ×1.00 · lean gain ×1.10 |
| **Protein** | `kg × g/kg` — lose fat 2.2 · maintain 1.8 · lean gain 2.0 |
| **Fat** | 25% of calories ÷ 9 (fat = 9 kcal/g) |
| **Carbs** | remaining calories ÷ 4: `(calories − protein×4 − fat×9) ÷ 4` |
| **Fiber** | 14 g per 1000 kcal |

**Example:** 80 kg, 180 cm, 30-year-old man, moderately active, maintaining →
BMR 1780 → TDEE 2759 kcal → protein 144 g, fat 77 g, carbs 373 g, fiber 39 g.

These are starting estimates, not medical advice. If your weight isn't changing the way you want after 2–3 weeks, adjust calories by 5–10%.

**Food amounts:** `actual = per-100 g value × grams eaten ÷ 100`. Example: yogurt with 10.3 g protein per 100 g, 170 g eaten → 10.3 × 170 ÷ 100 = 17.5 g protein.

## 5. Where is my data saved?

In your browser's **localStorage**, on that device. It stays there when you close the app or restart your phone. But:
- Data on your phone and data on your computer are **separate**.
- Clearing your browser's history/site data, or using private/incognito mode, **erases it**.

## 6. Project layout (what each file does)

```
server.js            The web server. Sends the app to your browser and handles label scans.
scanner.js           Server-only: sends the label photo to Claude and turns the answer into
                     per-100 g numbers. The only file that uses your API key.
.env.example         Template for secret settings. Copy to ".env" (never uploaded to GitHub).
public/
  index.html         The four screens (Today, Log, My Foods, Profile).
  styles.css         The look: colours, spacing, progress bars, dark mode.
  app.js             Screen behaviour: forms, buttons, drawing lists and bars.
  nutrition.js       All the maths (targets, per-100 g scaling, daily totals).
  storage.js         Saving/loading data. The only file that touches localStorage.
  api.js             Sends photos to our server and turns errors into friendly messages.
  image.js           Shrinks photos on the phone before upload (fast + cheap).
  config.js          The scanning server's address, for the GitHub Pages copy.
test/                Automated checks of the maths. Run with: npm test
```

## 7. Set up label scanning

### How it works (and why your key is safe)

```
Phone ──photo──▶ your server (server.js + scanner.js, holds the key) ──▶ Claude (claude-haiku-5-5)
Phone ◀──numbers── your server ◀──JSON── Claude
```

Everything in `public/` is downloaded to the phone, where anyone could read it. So the phone **never** talks to Claude and never sees the key. The key lives only in a `.env` file on the server, and `.env` is listed in `.gitignore`, so it is never uploaded to GitHub.

GitHub Pages can only host the app's pages, not a server. So for scanning you also run the server somewhere: either on **Render** (free, works from your phone) or on **your computer**.

### Step A: get a Claude API key

1. Go to <https://console.anthropic.com> and sign up or log in.
2. Tap **Billing** and add a small amount of credit (e.g. $5). Each scan costs a fraction of a cent.
3. Optional but smart: under **Settings → Limits**, set a monthly spend limit (e.g. $5).
4. Tap **API Keys** → **Create Key**, name it `nutrition-app`, and **copy** the key (it starts with `sk-ant-`). It is shown only once. Keep it somewhere private, like your password manager. Never paste it into a GitHub file.

### Step B (phone only): put the server on Render

1. Go to <https://render.com>, tap **Get Started**, and sign up with **GitHub**.
2. Tap **New +** → **Web Service**. Connect your GitHub account if asked, and give Render access to the **Nutrition-App** repository. Then pick it from the list.
3. Fill in the form:
   - **Name:** something like `nutrition-app-omar` (this becomes part of the address)
   - **Branch:** `claude/nutrition-tracking-app-fu2xs9`
   - **Language / Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
4. **Create the `.env` file on Render.** Scroll to **Environment Variables / Advanced**, find **Secret Files**, and tap **Add Secret File**:
   - **Filename:** `.env`
   - **Contents:** one line, with your key pasted straight after the `=` (no spaces, no quotes):
     ```
     ANTHROPIC_API_KEY=sk-ant-paste-your-key-here
     ```
   - Tap **Save**.

   (If you can't find Secret Files, you can instead add an **Environment Variable** with key `ANTHROPIC_API_KEY` and your key as the value. That works the same way.)
5. Tap **Create Web Service** (or **Deploy**). Wait for **Live** (a few minutes).
6. Copy your address from the top of the page, e.g. `https://nutrition-app-omar.onrender.com`.
7. Check it: open `https://YOUR-ADDRESS.onrender.com/api/health`. You should see `"scanningConfigured":true`.

> The free plan "sleeps" after about 15 minutes without use, so the first scan after a break can take up to a minute. The app tells you when this is happening. Later scans are quick.

### Step C (phone only): connect the GitHub Pages app to Render

1. In your phone's browser, open your repo on GitHub, then tap the `public` folder → `config.js`.
2. Tap the **pencil ✏️** (Edit) icon.
3. Find this line:
   ```js
   const SCAN_SERVER_FOR_GITHUB_PAGES = '';
   ```
   Put your Render address between the quotes (no slash at the end):
   ```js
   const SCAN_SERVER_FOR_GITHUB_PAGES = 'https://nutrition-app-omar.onrender.com';
   ```
4. Tap **Commit changes…** → **Commit changes**.
5. Wait about a minute for GitHub Pages to update (the **Actions** tab shows a ✅). Then fully close and reopen the app from your home-screen icon.

(The Render address is not a secret, so it's fine for it to be in GitHub. The key is the secret, and it stays on Render.)

### Alternative: run the server on your computer

1. In the terminal, go to the project folder (see section 1), then create your `.env` file from the template:
   - **Mac:** `cp .env.example .env`
   - **Windows:** `copy .env.example .env`
2. Open it in a plain text editor:
   - **Mac:** `open -e .env`
   - **Windows:** `notepad .env`
3. Find the line `ANTHROPIC_API_KEY=` and paste your key straight after the `=`, with no spaces or quotes:
   ```
   ANTHROPIC_API_KEY=sk-ant-paste-your-key-here
   ```
   Save (**Ctrl + S** / **⌘ + S**) and close the editor.
4. Check that Git will ignore it: `git check-ignore .env` should print `.env`.
5. Run `npm install`, then `npm start`. The terminal should say **Label scanning: ON**.
6. On your phone (same Wi-Fi), open the "On your phone" address the terminal prints.

### Safety limits built in
- At most **30 scans per hour** per device (change with `SCANS_PER_HOUR` in `.env`).
- Only your GitHub Pages site (and the server's own pages) can use the scanner from a browser (change with `ALLOWED_ORIGINS`).
- Photos are shrunk to about 0.2–0.5 MB on the phone before upload, and the server refuses anything too large.
- Photos aren't stored anywhere: the server passes each one to Claude and then forgets it.

### If you ever leak your key
Go to <https://console.anthropic.com> → **API Keys**, delete it, create a new one, and paste the new key into your `.env` (or Render secret file).
