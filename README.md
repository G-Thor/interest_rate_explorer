# Rates vs. Prices — Interest Rate Explorer

An interactive infographic showing how the world's central banks used interest
rates to fight the 2021–24 inflation shock — and how the response differed
systematically across types of economies.

**Open `docs/index.html` in a browser** (no build step, no server, no external
dependencies — everything is plain HTML/CSS/JS with the data embedded).

## What's inside

- **The economics** — a short grounding in why policy rates are the tool against
  inflation: the transmission mechanism, the real-rate ("Taylor principle")
  logic, transmission lags, and the role of credibility and anchored
  expectations.
- **The Great Tightening** — median policy-rate paths since 2019 for five
  country groups.
- **Explorer** — per-economy dual chart (policy rate vs. year-on-year CPI
  inflation) for 35 economies, with the central bank's inflation-target band,
  selectable time windows back to 1980, hover crosshair, cycle statistics
  (first hike, total tightening, peak inflation, cuts from peak) and a short
  curated story for every economy.
- **Reaction map** — log-log scatter of peak inflation faced vs. total
  tightening delivered, one bubble per central bank.
- **Reaction lag** — for each economy, the inflation lead (months) that best
  correlates with the policy rate, 2010–22.
- **Five monetary worlds** — group-level dumbbells of peak inflation → 2024
  inflation, with the systemic story of each group.

## Country groups

Groups follow the *monetary regime*, not geography, because that is where the
systemic differences live:

| Group | Members | Why they behave alike |
|---|---|---|
| Advanced majors | US, Euro area, Japan, UK, Canada, Australia, South Korea | Deep markets, credible 2% targets; could afford to move later and stop lower |
| Small open advanced | Switzerland, Sweden, Norway, New Zealand, Iceland | Exchange-rate exposure forces early action; strong credibility allows low peaks |
| EM inflation targeters | Brazil, Mexico, Chile, Colombia, Peru, Poland, Czechia, Hungary, Romania, South Africa, Israel, India, Indonesia, Thailand, Malaysia, Philippines | Shorter credibility record and fragile currencies ⇒ hike sooner and higher |
| High-inflation outliers | Türkiye, Argentina, Russia | Frameworks overridden by politics, deficits or sanctions |
| Pegged & managed | China, Saudi Arabia, Hong Kong, Denmark | Pegs import foreign policy; capital controls (China) decouple from it |

## Data

All raw source snapshots are committed under `data/raw/` and processed into
`docs/data.js` by `scripts/build_data.py` (Python 3, needs `pandas` +
`openpyxl`).

| Variable | Source | Coverage used |
|---|---|---|
| Policy rates (monthly, end of period) | **BIS** Central bank policy rates (`WS_CBPOL`), via the DBnomics mirror | 1980-01 → 2025-05, 38 economies |
| CPI inflation (monthly, YoY) | **World Bank** Global Database of Inflation (Ha, Kose & Ohnsorge), `hcpi_m`/`hcpi_q` | 1980-01 → 2022-12 |
| CPI inflation (annual, YoY) | **BIS** long consumer-price series (`WS_LONG_CPI`) | → 2024 (drawn dashed) |
| Euro-area HICP (monthly, YoY) | **Eurostat** `prc_hicp_manr` | 2020-01 → 2025-04 |
| Latest-rate annotations (Fed, ECB, BoE, BoJ, SNB) | **BIS** bulk download summary of 2026-05-06 | as of 2026-04 |

See `data/raw/SOURCES.md` for file-level provenance and retrieval notes.

### Caveats

- Policy-rate definitions change within countries over time (the BIS source
  documents each switch); the euro-area series follows the ECB's headline
  instrument.
- The inflation line switches from monthly to annual resolution after 2022
  (dashed, diamond markers) — annual averages smooth over intra-year swings.
- Lag correlations are descriptive statistics, not causal estimates.

## Deploying as a GitHub Pages site

The site is fully static (`docs/` is the complete site root), so it deploys
with one setting and no build step:

1. On GitHub: **Settings → Pages**
2. Under *Build and deployment*, set **Source: Deploy from a branch**
3. Pick **Branch: `master`**, **Folder: `/docs`**, and save

GitHub publishes it at `https://g-thor.github.io/interest_rate_explorer/`
within a minute or two, and republishes automatically on every push to
`master` that touches `docs/`.

## Repo layout

```
data/raw/              committed source snapshots (BIS, World Bank, Eurostat)
scripts/build_data.py  raw files → docs/data.js
docs/                  the infographic (open index.html)
```

To rebuild the data file: `pip install pandas openpyxl && python3 scripts/build_data.py`
