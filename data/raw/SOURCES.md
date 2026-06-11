# Raw data provenance

This environment had no direct network access to the BIS, World Bank, IMF or
Eurostat APIs, so the files below are snapshots of those official datasets
mirrored on GitHub. Each file's content is an unmodified export of the
original provider's data; provenance is verifiable from the file headers
and the mirror repositories. Retrieved 2026-06-11.

| File | Dataset | Original provider | Mirror retrieved from | Vintage |
|---|---|---|---|---|
| `bis_cbpol_monthly_dbnomics.xlsx` | BIS Central bank policy rates (`WS_CBPOL`), monthly, end of period, 49 series | Bank for International Settlements (data.bis.org) via DBnomics | `RichardLu2001/Dbnomics_Data_Pipeline` (`Aggregator/BIS_cbrate/BIS_cbrate.xlsx`) | data through 2025-05 |
| `worldbank_global_inflation_db.xlsx` | Global Database of Inflation (Ha, Kose & Ohnsorge): `hcpi_m`, `hcpi_q`, … headline CPI indices, 188 countries | World Bank (worldbank.org/en/research/brief/inflation-database) | `sebatinoco/rl_bertrand2` (`inflation/Inflation-data.xlsx`) | data through 2022-12 |
| `bis_long_cpi_annual_dbnomics.csv` | BIS long consumer-price series (`WS_LONG_CPI`), annual index + YoY, 63 areas | Bank for International Settlements via DBnomics | `RichardLu2001/Dbnomics_Data_Pipeline` (`Aggregator/BIS_CPI/`) | data through 2024 |
| `eurostat_hicp_manr_2020_2025.csv` | HICP — annual rate of change (`prc_hicp_manr`), monthly, EU + euro area | Eurostat | `svetoslavpetkov/eu-inflation-croatia` (`data/`) | extracted 2025-06-03, data through 2025-04 |
| `bis_cbpol_latest_summary_2026-05.csv` | Summary of latest policy rates from the BIS bulk flat file (`WS_CBPOL_csv_flat.zip`) | Bank for International Settlements | `palmalo/bis_prates` (`out/summary.csv`, workflow run 2026-05-06) | rates as of 2026-04-28 |

Validation performed during ingestion:

- BIS policy-rate values cross-checked against well-documented benchmarks
  (fed funds target path 2020–25, ECB key-rate path, Selic, CBRT 8.5→50%,
  Bank of Russia 20%/21% peaks, RBA 4.35% peak and 2025 cuts, PBoC 1-year
  LPR 3.85→3.0).
- World Bank monthly CPI YoY recomputed from the index and spot-checked
  against known prints (US 9.1% June 2022, euro-member peaks in late 2022).
- BIS annual YoY (2023–24) spot-checked (e.g. Türkiye ≈54%/58%, Argentina
  ≈133%/220%, US 4.1%/2.9%).
