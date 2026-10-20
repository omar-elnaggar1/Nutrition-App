# Nutrition Tracker

A simple personal nutrition tracker that runs in your phone's browser.

**Phase 1 features:** profile & daily targets · manual food logging · "My Foods" one-tap re-logging · daily dashboard with progress bars · data saved on your device.

---

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
5. Start the app:
   ```
   npm start
   ```
   You'll see:
   ```
   Nutrition app running!
     On this computer:  http://localhost:3000
     On your phone (same Wi-Fi):  http://192.168.1.23:3000
   ```
6. Open `http://localhost:3000` in your computer's browser.

To stop the server, click in the terminal and press **Ctrl + C**.

No `npm install` is needed — the app uses no extra libraries.

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
2. **Log tab** → type the food name, grams eaten, and the **per 100 g** numbers from the label. A preview shows what you actually ate. Leave **Also save to My Foods** ticked to save it for next time → **Log this food**.
3. **My Foods tab** → tap **Log** to add your usual amount in one tap. Tap ✎ to log a different amount, or 🗑 to delete.
4. **Today tab** → progress bars for each target. Bars turn red if you go over. Tap ✕ to remove an entry.

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
server.js            The web server. Sends the app to your browser and will hold the
                     Claude API key for label scanning (Phase 2).
.env.example         Template for secret settings. Copy to ".env" (never uploaded to GitHub).
public/
  index.html         The four screens (Today, Log, My Foods, Profile).
  styles.css         The look: colours, spacing, progress bars, dark mode.
  app.js             Screen behaviour: forms, buttons, drawing lists and bars.
  nutrition.js       All the maths (targets, per-100 g scaling, daily totals).
  storage.js         Saving/loading data. The only file that touches localStorage.
  api.js             Talks to our own server (used for photo scanning later).
test/                Automated checks of the maths. Run with: npm test
```

## 7. Getting ready for Phase 2: label scanning with Claude

The plumbing is already in place:
- `server.js` has a route `POST /api/scan-label`, which currently replies "coming in Phase 2".
- `public/api.js` has `scanLabel(photo)`, which sends a photo to that route.

**Why it's built this way:** anything in the `public/` folder gets downloaded to the phone, where anyone could read it. So the phone never talks to Claude directly. It sends the photo to **our server**, and the server adds the secret key and calls Claude.

When you're ready:
1. Get an API key at <https://console.anthropic.com/>.
2. In the project folder, copy `.env.example` to a new file named `.env` and paste the key after `ANTHROPIC_API_KEY=`.
3. Restart with `npm start`. Visiting `http://localhost:3000/api/health` should then show `"scanningConfigured": true`.
4. Fill in `handleScanLabel` in `server.js` and add a "Scan label" button to the Log screen.

`.env` is listed in `.gitignore`, so your key is never uploaded to GitHub.
