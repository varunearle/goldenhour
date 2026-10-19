# Golden Hour: road collision triage and ambulance standby planning

Class demonstration for Domain 57 (Public Safety: emergency response and safety analysis),
course 24CSEN2151 Artificial Intelligence, GITAM University.
Student: [name] · [registration number]

After a road collision, the first hour decides many outcomes. Golden Hour helps an emergency service in two ways:

1. **Triage (call handler).** From what a caller can report, a logistic regression model estimates the chance
   that someone has been killed or seriously injured, explains which answers drive the estimate, assigns a
   priority (P1 Immediate, P2 Urgent, P3 Routine) and shows how often similar real collisions turned out serious.
2. **Planning (planner).** For Birmingham, DBSCAN finds collision hotspots, and K-Means places ambulance standby
   points where past fatal and serious collisions happened, tested on later months.

Everything runs on real data: the Department for Transport's STATS19 road safety data for Great Britain, 2015.

## Results (all on data the methods never saw)

Severity model, trained January to September 2015, tested on all 36,416 collisions of October to December 2015:

| Model | AUC | Average precision | Brier |
|---|---|---|---|
| Base rate | 0.500 | 0.158 | 0.1329 |
| **Logistic regression (used in the app)** | **0.719** | **0.311** | **0.1223** |
| Gradient boosted trees (reference) | 0.733 | 0.347 | 0.1194 |

- Priority 1 holds 9.2% of calls; 39.3% of them were fatal or serious, against 15.8% overall.
- Flagging the same 49.6% of calls as a simple rule (60/70 mph, pedestrian, or motorcycle), the model catches
  76.4% of fatal or serious collisions; the rule catches 68.8%.

Birmingham standby points (5 points), learned from 288 fatal or serious collisions of January to September,
tested on the 121 of October to December:

| Placement | Mean straight-line distance | Within 3 km |
|---|---|---|
| **K-Means on past serious collisions** | **2.32 km** | **73.6%** |
| Evenly spread over the area | 3.81 km | 26.4% |
| Random past collision sites (1,000 draws) | 3.50 km | 47.8% |

## Folder

```
app/                      the web application (React, TypeScript, Vite, Tailwind)
  src/lib/model.ts        the model applied in the browser, priority bands, AUC
  src/lib/data.ts         test set and Birmingham data, similar-collision lookup
  src/lib/store.tsx       calls, sign-in role, input limits, validation of stored data
  src/pages/              Sign in, New call, Call queue, Hotspots and standby, Model, Settings, Privacy, Terms
  src/data/               model.json, testset.json, birmingham.json (produced by the model scripts)
  src/lib/model.test.ts   unit tests
  verify/e2e.mjs          browser walkthrough of every screen, including security checks
model/
  features.py             one row per collision, using only what a caller can report
  train.py                severity models, evaluation, priority bands, exports model.json and testset.json
  hotspots.py             DBSCAN hotspots and K-Means standby points for Birmingham, exports birmingham.json
  test_pipeline.py        checks the data against the official totals and the exports for consistency
```

## Run the app

Requires Node.js 18 or newer.

```bash
cd app
npm install
npm run dev            # http://localhost:5173
```

For the class demo use the production build, which works without internet:

```bash
npm run build
npm run preview        # http://localhost:4173
```

| Role | Email | Password |
|---|---|---|
| Call handler | handler@goldenhour.demo | goldenhour |
| Planner | planner@goldenhour.demo | goldenhour |

The sign-in page also has a "Use the demo account" link that fills these in.

## Deploy

Import the `app` folder as a Vercel project (framework: Vite). `vercel.json` sends every route to `index.html`
and sets the security headers.

## Rebuild the model from the data

The official files are published at gov.uk ("Road safety open data"). The 2015 files used here, with the official
data guide, are also in the public repository https://github.com/Luis-3M/RoadSafetyDataMining. They were checked
against the DfT's published 2015 totals (140,056 collisions, 1,730 killed, 22,144 seriously injured, 186,189
casualties); their SHA-256 hashes are on the app's Model page.

```bash
pip install -r model/requirements.txt
git clone --depth 1 https://github.com/Luis-3M/RoadSafetyDataMining data
cd model
python train.py ../data          # severity model, about 20 seconds
python hotspots.py ../data       # Birmingham hotspots and standby points, about 1 minute
python test_pipeline.py ../data
```

## Checks

```bash
cd app
npm test                                          # 13 unit tests
npm audit                                         # 0 vulnerabilities
npm run preview &
node verify/e2e.mjs http://localhost:4173 shots   # needs Playwright: npm i -D playwright
```

The unit tests confirm that the browser reproduces the Python model's probabilities (to 1e-9), its test AUC and
its priority bands exactly, and cover CSV safety and validation of stored data. The browser walkthrough signs in
as both roles, logs a call, checks the displayed estimate against an independent calculation, replays a real day,
recomputes the AUC in the browser, uses the map, tries script injection, a spreadsheet formula and tampered
storage, checks role separation, phone width, that no page contains em or en dashes, that nothing loads from
other sites and that the console stays free of errors.

## Security

Golden Hour is a static site: no server, API, database, API keys or environment variables, and no data leaves
the browser.

- **Headers** (`app/vercel.json`, also served by `npm run preview`): a strict Content Security Policy (the
  site's own scripts, styles, fonts and images only), no framing, `nosniff`, no referrer, HSTS, cross-origin
  isolation, and camera, microphone, location, payment and USB turned off.
- **Input**: React escapes all text and the app never injects HTML. Free text is cleaned of control
  characters and capped (location 80, names 60 characters). CSV exports escape quotes and neutralise
  spreadsheet formulas.
- **Stored data** is validated on load: malformed calls, unknown answers, statuses or roles are discarded, and
  the risk is always recalculated from the answers rather than read from storage.
- **Roles**: a call handler cannot open the planner's pages and the reverse. The two demo accounts select a view;
  they do not protect anything, because every visitor only ever sees their own browser's data.
- **Build**: production React, no source maps, no inline scripts, fonts and data bundled, no requests to other
  sites. `npm audit`: 0 vulnerabilities.

## Limitations

- Only injury collisions recorded by police are included, so the model cannot separate damage-only crashes.
- Each answer adds its effect independently, so rare dangerous combinations are underestimated; the call screen
  shows similar real collisions alongside the estimate for this reason.
- Trained on Great Britain in 2015; it would need retraining on Indian data before any real use.
- It supports a trained call handler and never replaces their judgement or clinical triage.

## Data licence and references

Contains public sector information licensed under the Open Government Licence v3.0.

- Department for Transport, Road Safety Data (STATS19), 2015, and the Road Accident Safety Data Guide.
- Department for Transport, Reported Road Casualties Great Britain: Annual Report 2015.
- D. W. Hosmer, S. Lemeshow and R. X. Sturdivant, *Applied Logistic Regression*, 3rd ed., Wiley, 2013.
- M. Ester, H.-P. Kriegel, J. Sander and X. Xu, "A density-based algorithm for discovering clusters in large
  spatial databases with noise," *Proc. KDD*, 1996.
- S. Lloyd, "Least squares quantization in PCM," *IEEE Transactions on Information Theory*, 28(2), 1982.
