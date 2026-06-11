#!/usr/bin/env python3
"""Build docs/data.js for the Interest Rate Explorer.

Sources (all committed under data/raw/):
  - bis_cbpol_monthly_dbnomics.xlsx   BIS "Central bank policy rates" (WS_CBPOL),
                                      monthly, end-of-period, via the DBnomics
                                      mirror. Coverage: 1946-01 .. 2025-05.
  - worldbank_global_inflation_db.xlsx  World Bank "Global Database of Inflation"
                                      (Ha, Kose & Ohnsorge), sheets hcpi_m /
                                      hcpi_q: headline CPI index, monthly /
                                      quarterly, 1970-01 .. 2022-12.
  - bis_long_cpi_annual_dbnomics.csv  BIS "Consumer prices" long series
                                      (WS_LONG_CPI), annual YoY %, .. 2024.
  - eurostat_hicp_manr_2020_2025.csv  Eurostat prc_hicp_manr: euro-area HICP
                                      annual rate of change, monthly,
                                      2020-01 .. 2025-04.
  - bis_cbpol_latest_summary_2026-05.csv  BIS bulk download summary
                                      (2026-05-06): latest policy rates for a
                                      few majors, used for annotations only.

Output: docs/data.js  (window.IRX_DATA = {...})
"""

import csv
import json
import math
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "docs" / "data.js"

START = "1980-01"          # chart history starts here
RATE_END = "2025-05"       # last month of BIS policy-rate data
CPI_M_END = "2022-12"      # last month of World Bank monthly CPI

# ---------------------------------------------------------------- economies
# group ids: majors | small_open | em_target | high_inflation | pegged
ECONOMIES = [
    # iso2, iso3, name, central bank, group, inflation target (display), target band [lo, hi] or None
    ("US", "USA", "United States", "Federal Reserve", "majors", "2% (PCE)", [2, 2]),
    ("XM", "EMU", "Euro area", "European Central Bank", "majors", "2%", [2, 2]),
    ("JP", "JPN", "Japan", "Bank of Japan", "majors", "2%", [2, 2]),
    ("GB", "GBR", "United Kingdom", "Bank of England", "majors", "2%", [2, 2]),
    ("CA", "CAN", "Canada", "Bank of Canada", "majors", "2% (1–3%)", [1, 3]),
    ("AU", "AUS", "Australia", "Reserve Bank of Australia", "majors", "2–3%", [2, 3]),
    ("KR", "KOR", "South Korea", "Bank of Korea", "majors", "2%", [2, 2]),

    ("CH", "CHE", "Switzerland", "Swiss National Bank", "small_open", "0–2%", [0, 2]),
    ("SE", "SWE", "Sweden", "Riksbank", "small_open", "2% (CPIF)", [2, 2]),
    ("NO", "NOR", "Norway", "Norges Bank", "small_open", "2%", [2, 2]),
    ("NZ", "NZL", "New Zealand", "Reserve Bank of New Zealand", "small_open", "1–3%", [1, 3]),
    ("IS", "ISL", "Iceland", "Central Bank of Iceland", "small_open", "2.5%", [2.5, 2.5]),

    ("BR", "BRA", "Brazil", "Banco Central do Brasil", "em_target", "3% ±1.5", [1.5, 4.5]),
    ("MX", "MEX", "Mexico", "Banco de México", "em_target", "3% ±1", [2, 4]),
    ("CL", "CHL", "Chile", "Banco Central de Chile", "em_target", "3% ±1", [2, 4]),
    ("CO", "COL", "Colombia", "Banco de la República", "em_target", "3% ±1", [2, 4]),
    ("PE", "PER", "Peru", "Banco Central de Reserva del Perú", "em_target", "2% ±1", [1, 3]),
    ("PL", "POL", "Poland", "Narodowy Bank Polski", "em_target", "2.5% ±1", [1.5, 3.5]),
    ("CZ", "CZE", "Czechia", "Czech National Bank", "em_target", "2% ±1", [1, 3]),
    ("HU", "HUN", "Hungary", "Magyar Nemzeti Bank", "em_target", "3% ±1", [2, 4]),
    ("RO", "ROU", "Romania", "National Bank of Romania", "em_target", "2.5% ±1", [1.5, 3.5]),
    ("ZA", "ZAF", "South Africa", "South African Reserve Bank", "em_target", "3–6%", [3, 6]),
    ("IL", "ISR", "Israel", "Bank of Israel", "em_target", "1–3%", [1, 3]),
    ("IN", "IND", "India", "Reserve Bank of India", "em_target", "4% ±2", [2, 6]),
    ("ID", "IDN", "Indonesia", "Bank Indonesia", "em_target", "2.5% ±1", [1.5, 3.5]),
    ("TH", "THA", "Thailand", "Bank of Thailand", "em_target", "1–3%", [1, 3]),
    ("MY", "MYS", "Malaysia", "Bank Negara Malaysia", "em_target", "no formal target", None),
    ("PH", "PHL", "Philippines", "Bangko Sentral ng Pilipinas", "em_target", "3% ±1", [2, 4]),

    ("TR", "TUR", "Türkiye", "Central Bank of the Republic of Türkiye", "high_inflation", "5% (de jure)", [3, 7]),
    ("AR", "ARG", "Argentina", "Banco Central de la República Argentina", "high_inflation", "no formal target", None),
    ("RU", "RUS", "Russia", "Bank of Russia", "high_inflation", "4%", [4, 4]),

    ("CN", "CHN", "China", "People's Bank of China", "pegged", "~3% (gov. ceiling)", None),
    ("SA", "SAU", "Saudi Arabia", "Saudi Central Bank (SAMA)", "pegged", "USD peg", None),
    ("HK", "HKG", "Hong Kong SAR", "Hong Kong Monetary Authority", "pegged", "USD peg (currency board)", None),
    ("DK", "DNK", "Denmark", "Danmarks Nationalbank", "pegged", "EUR peg (ERM II)", None),
]

GROUPS = {
    "majors": {
        "name": "Advanced majors",
        "desc": "Large advanced economies with independent, inflation-targeting central banks.",
    },
    "small_open": {
        "name": "Small open advanced",
        "desc": "Small, trade-exposed advanced economies; exchange-rate pass-through makes them quick to move.",
    },
    "em_target": {
        "name": "Emerging-market inflation targeters",
        "desc": "Emerging markets that adopted formal inflation targets; many hiked early and hard in 2021.",
    },
    "high_inflation": {
        "name": "High-inflation outliers",
        "desc": "Economies fighting chronic or policy-induced inflation with unorthodox detours.",
    },
    "pegged": {
        "name": "Pegged & managed regimes",
        "desc": "Currency pegs import foreign monetary policy; managed systems answer to other goals.",
    },
}


def ym_range(start, end):
    y0, m0 = map(int, start.split("-"))
    y1, m1 = map(int, end.split("-"))
    out = []
    y, m = y0, m0
    while (y, m) <= (y1, m1):
        out.append(f"{y:04d}-{m:02d}")
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


def series_to_compact(d, start, end):
    """dict period->value  ->  {start, v:[...]} trimmed to first..last non-null."""
    months = ym_range(start, end)
    vals = [d.get(p) for p in months]
    first = next((i for i, v in enumerate(vals) if v is not None), None)
    if first is None:
        return None
    last = max(i for i, v in enumerate(vals) if v is not None)
    return {"start": months[first], "v": [None if v is None else round(v, 2) for v in vals[first:last + 1]]}


def r2(x):
    return None if x is None else round(float(x), 2)


# ------------------------------------------------------------- policy rates
def load_rates():
    df = pd.read_excel(RAW / "bis_cbpol_monthly_dbnomics.xlsx")
    rates = {}
    for code, sub in df.groupby("REF_AREA"):
        d = {}
        for _, row in sub.iterrows():
            p = str(row["original_period"])
            v = row["value"]
            if p >= START and not (isinstance(v, float) and math.isnan(v)):
                d[p] = float(v)
        rates[code] = d
    return rates


# ---------------------------------------------------------------- inflation
def load_wb_monthly():
    xl = pd.ExcelFile(RAW / "worldbank_global_inflation_db.xlsx")
    df = xl.parse("hcpi_m")
    per_cols = [c for c in df.columns if isinstance(c, int)]
    out = {}
    for _, row in df.iterrows():
        iso3 = row["Country Code"]
        if not isinstance(iso3, str):
            continue
        idx = {}
        for c in per_cols:
            v = row[c]
            if isinstance(v, (int, float)) and not (isinstance(v, float) and math.isnan(v)):
                idx[f"{c // 100:04d}-{c % 100:02d}"] = float(v)
        yoy = {}
        for p, v in idx.items():
            y, m = map(int, p.split("-"))
            prev = idx.get(f"{y - 1:04d}-{m:02d}")
            if prev and prev > 0 and p >= START:
                yoy[p] = (v / prev - 1.0) * 100.0
        out[iso3] = yoy
    return out


def load_wb_quarterly_aus():
    xl = pd.ExcelFile(RAW / "worldbank_global_inflation_db.xlsx")
    df = xl.parse("hcpi_q")
    row = df[df["Country Code"] == "AUS"].iloc[0]
    idx = {}
    for c in df.columns:
        if isinstance(c, int):
            v = row[c]
            if isinstance(v, (int, float)) and not (isinstance(v, float) and math.isnan(v)):
                idx[c] = float(v)  # e.g. 20223 = 2022 Q3
    yoy = {}
    for c, v in idx.items():
        prev = idx.get(c - 10)
        if prev and prev > 0:
            y, q = c // 10, c % 10
            p = f"{y:04d}-{q * 3:02d}"  # place at quarter-end month
            if p >= START:
                yoy[p] = (v / prev - 1.0) * 100.0
    return yoy


def load_eurostat_ea():
    yoy = {}
    with open(RAW / "eurostat_hicp_manr_2020_2025.csv", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row["geo"].startswith("Euro area") and row["OBS_VALUE"]:
                yoy[row["TIME_PERIOD"]] = float(row["OBS_VALUE"])
    return yoy


def load_bis_annual():
    with open(RAW / "bis_long_cpi_annual_dbnomics.csv", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    hdr = rows[0]
    cols = {}  # iso2 -> column index of the .771 (YoY) series
    for i, h in enumerate(hdr):
        m = re.search(r"WS_LONG_CPI/A\.([A-Z]{2})\.771\)", h)
        if m:
            cols[m.group(1)] = i
    out = {}
    for iso2, i in cols.items():
        d = {}
        for row in rows[1:]:
            year = row[0]
            if year.isdigit() and int(year) >= 1980 and i < len(row):
                v = row[i]
                if v and v != "NA":
                    d[int(year)] = float(v)
        out[iso2] = d
    return out


# -------------------------------------------------------------------- stats
def monthly_get(compact, period):
    if not compact:
        return None
    months = ym_range(compact["start"], "2026-12")
    try:
        i = months.index(period)
    except ValueError:
        return None
    return compact["v"][i] if i < len(compact["v"]) else None


def pearson(xs, ys):
    n = len(xs)
    if n < 24:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxy = sum((a - mx) * (b - my) for a, b in zip(xs, ys))
    sxx = sum((a - mx) ** 2 for a in xs)
    syy = sum((b - my) ** 2 for b in ys)
    if sxx == 0 or syy == 0:
        return None
    return sxy / math.sqrt(sxx * syy)


def best_lag(rate_d, cpi_d):
    """Correlation between policy rate and inflation lagged 0..24 months
    (inflation leading), monthly levels, window 2010-01..2022-12."""
    window = ym_range("2010-01", "2022-12")
    months_all = ym_range("1980-01", "2026-12")
    pos = {p: i for i, p in enumerate(months_all)}
    best = None
    for lag in range(0, 25):
        xs, ys = [], []
        for p in window:
            r = rate_d.get(p)
            i = pos[p] - lag
            c = cpi_d.get(months_all[i]) if i >= 0 else None
            if r is not None and c is not None:
                xs.append(c)
                ys.append(r)
        corr = pearson(xs, ys)
        if corr is not None and (best is None or corr > best[1]):
            best = (lag, corr)
    return {"lag": best[0], "r": round(best[1], 2)} if best else None


def cycle_stats(rate_d, cpi_m, cpi_a, eco_iso2):
    months = ym_range("2020-01", RATE_END)
    series = [(p, rate_d.get(p)) for p in months if rate_d.get(p) is not None]
    if not series:
        return {}
    trough_p, trough = min(series[:30] or series, key=lambda t: t[1])  # low point 2020–mid-22
    after = [t for t in series if t[0] >= trough_p]
    peak_p, peak = max(after, key=lambda t: t[1]) if after else (None, None)
    latest_p, latest = series[-1]
    # first hike: first month after trough where rate rises >= 0.1pp above trough
    first_hike = next((p for p, v in after if v >= trough + 0.10), None)
    # peak inflation 2021 onward: monthly (..2022-12 / ..2025-04 for XM) + annual 2023/24
    cands = []
    for p, v in cpi_m.items():
        if p >= "2021-01":
            cands.append((p, v))
    for y in (2023, 2024):
        if y in cpi_a:
            cands.append((f"{y}", cpi_a[y]))
    peak_cpi_p, peak_cpi = max(cands, key=lambda t: t[1]) if cands else (None, None)
    return {
        "trough": r2(trough), "troughP": trough_p,
        "peak": r2(peak), "peakP": peak_p,
        "latest": r2(latest), "latestP": latest_p,
        "hikePP": r2(peak - trough) if peak is not None else None,
        "cutPP": r2(peak - latest) if peak is not None else None,
        "firstHike": first_hike,
        "peakCPI": r2(peak_cpi), "peakCPIP": peak_cpi_p,
    }


def main():
    rates = load_rates()
    wb = load_wb_monthly()
    wb_aus = load_wb_quarterly_aus()
    ea = load_eurostat_ea()
    bis_a = load_bis_annual()

    countries = {}
    for iso2, iso3, name, bank, group, target, band in ECONOMIES:
        rate_d = rates.get(iso2, {})
        if iso2 == "XM":
            cpi_m = ea
        elif iso2 == "AU":
            cpi_m = wb_aus
        else:
            cpi_m = wb.get(iso3, {})
        cpi_a = bis_a.get(iso2, {})

        rate_c = series_to_compact(rate_d, START, RATE_END)
        cpi_end = "2025-04" if iso2 == "XM" else CPI_M_END
        cpi_c = series_to_compact(cpi_m, START, cpi_end)

        countries[iso2] = {
            "iso2": iso2, "iso3": iso3, "name": name, "bank": bank,
            "group": group, "target": target, "band": band,
            "rate": rate_c,
            "cpiM": cpi_c,
            "cpiQuarterly": iso2 == "AU",
            "cpiA": {str(y): r2(v) for y, v in sorted(cpi_a.items())},
            "stats": cycle_stats(rate_d, cpi_m, cpi_a, iso2),
            "lagCorr": best_lag(rate_d, cpi_m),
        }

    # group median policy-rate paths for the hero chart, 2019-01..2025-05
    hero_months = ym_range("2019-01", RATE_END)
    medians = {}
    for gid in GROUPS:
        isos = [e[0] for e in ECONOMIES if e[4] == gid]
        path = []
        for p in hero_months:
            vals = sorted(v for v in (rates.get(i, {}).get(p) for i in isos) if v is not None)
            if vals:
                n = len(vals)
                med = vals[n // 2] if n % 2 else (vals[n // 2 - 1] + vals[n // 2]) / 2
                path.append(round(med, 2))
            else:
                path.append(None)
        medians[gid] = path

    # latest-rate annotations from the BIS bulk summary (2026-05-06 run)
    latest_known = {}
    with open(RAW / "bis_cbpol_latest_summary_2026-05.csv", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row.get("latest_rate_pct"):
                latest_known[row["resolved_country_code"]] = {
                    "rate": float(row["latest_rate_pct"]),
                    "date": row["latest_date"],
                }

    data = {
        "meta": {
            "rateEnd": RATE_END,
            "cpiMonthlyEnd": CPI_M_END,
            "cpiAnnualEnd": 2024,
            "built": "2026-06-11",
        },
        "groups": GROUPS,
        "groupOrder": ["majors", "small_open", "em_target", "high_inflation", "pegged"],
        "countries": countries,
        "countryOrder": [e[0] for e in ECONOMIES],
        "heroMonths": hero_months,
        "heroMedians": medians,
        "latestKnown": latest_known,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, separators=(",", ":"), allow_nan=False)
    OUT.write_text("window.IRX_DATA=" + payload + ";\n")
    print(f"wrote {OUT} ({OUT.stat().st_size/1024:.0f} KB)")
    # quick sanity report
    for iso2 in ("US", "XM", "TR", "AU", "CN"):
        c = countries[iso2]
        print(iso2, "rate:", c["rate"]["start"], "..", len(c["rate"]["v"]), "pts |",
              "cpiM:", c["cpiM"]["start"] if c["cpiM"] else None,
              "| stats:", c["stats"], "| lag:", c["lagCorr"])


if __name__ == "__main__":
    main()
