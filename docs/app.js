/* Rates vs. Prices — interactive infographic.
   Vanilla JS + hand-rolled SVG. Data injected by data.js (window.IRX_DATA). */
"use strict";

const D = window.IRX_DATA;
const GROUP_COLOR = {
  majors: "#4da3ff",
  small_open: "#3ed6c0",
  em_target: "#ffb43a",
  high_inflation: "#ff5d73",
  pegged: "#b48cff",
};
const CPI_COLOR = "#d7dee8";
const SVG_NS = "http://www.w3.org/2000/svg";

/* ---------------------------------------------------------- month helpers */
function ymToNum(p) { // "1980-03" -> 1980 + 2/12
  const y = +p.slice(0, 4), m = +p.slice(5, 7);
  return y + (m - 1) / 12;
}
function numToYm(x) {
  const y = Math.floor(x + 1e-6);
  const m = Math.round((x - y) * 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}
function fmtMonth(p) {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[+p.slice(5, 7) - 1]} ${p.slice(0, 4)}`;
}
function seriesPoints(compact) { // {start, v} -> [[num, val], ...] (nulls skipped)
  if (!compact) return [];
  const out = [];
  let t = ymToNum(compact.start);
  for (const v of compact.v) {
    if (v !== null) out.push([t, v]);
    t += 1 / 12;
  }
  return out;
}

/* ------------------------------------------------------------ svg helpers */
function el(name, attrs, parent) {
  const n = document.createElementNS(SVG_NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
function lin(domain, range) {
  const [d0, d1] = domain, [r0, r1] = range;
  const f = x => r0 + (x - d0) / (d1 - d0) * (r1 - r0);
  f.invert = y => d0 + (y - r0) / (r1 - r0) * (d1 - d0);
  return f;
}
function logScale(domain, range) {
  const [d0, d1] = domain.map(Math.log10), [r0, r1] = range;
  return x => r0 + (Math.log10(x) - d0) / (d1 - d0) * (r1 - r0);
}
function pathFrom(points, x, y) {
  let d = "";
  for (let i = 0; i < points.length; i++) {
    d += (i ? "L" : "M") + x(points[i][0]).toFixed(1) + "," + y(points[i][1]).toFixed(1);
  }
  return d;
}
function niceTicks(lo, hi, n) {
  const span = hi - lo;
  const step0 = span / Math.max(n, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  let step = mag;
  for (const m of [1, 2, 2.5, 5, 10]) { if (step0 <= m * mag) { step = m * mag; break; } }
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

/* ---------------------------------------------------------------- tooltip */
const tooltip = document.getElementById("tooltip");
function showTip(html, ev) {
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  const pad = 14;
  let x = ev.clientX + pad, y = ev.clientY + pad;
  const r = tooltip.getBoundingClientRect();
  if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - pad;
  tooltip.style.left = x + "px";
  tooltip.style.top = y + "px";
}
function hideTip() { tooltip.hidden = true; }

/* ----------------------------------------------------------- vintage chips */
(function vintage() {
  const host = document.getElementById("vintage-chips");
  const chips = [
    `Policy rates: monthly → ${fmtMonth(D.meta.rateEnd)}`,
    `Inflation: monthly → ${fmtMonth(D.meta.cpiMonthlyEnd)}, annual → ${D.meta.cpiAnnualEnd}`,
    `${D.countryOrder.length} economies · 5 regime groups`,
  ];
  for (const c of chips) {
    const s = document.createElement("span");
    s.className = "chip";
    s.textContent = c;
    host.appendChild(s);
  }
})();

/* --------------------------------------------------------------- hero chart */
(function hero() {
  const host = document.getElementById("hero-chart");
  const W = 960, H = 360, M = { l: 44, r: 16, t: 14, b: 26 };
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}` }, host);

  const t0 = ymToNum(D.heroMonths[0]);
  const t1 = ymToNum(D.heroMonths[D.heroMonths.length - 1]);
  const YMAX = 20;
  const x = lin([t0, t1], [M.l, W - M.r]);
  const y = lin([0, YMAX], [H - M.b, M.t]);

  for (const v of niceTicks(0, YMAX, 5)) {
    el("line", { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: "grid-line" }, svg);
    el("text", { x: M.l - 8, y: y(v) + 4, "text-anchor": "end", class: "axis-label" }, svg).textContent = v + "%";
  }
  for (let yr = 2019; yr <= 2025; yr++) {
    el("text", { x: x(yr), y: H - 8, "text-anchor": "middle", class: "axis-label" }, svg).textContent = yr;
  }

  const clip = el("clipPath", { id: "heroclip" }, svg);
  el("rect", { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b }, clip);
  const g = el("g", { "clip-path": "url(#heroclip)" }, svg);

  let clippedMax = 0, clippedAt = null;
  for (const gid of D.groupOrder) {
    const pts = D.heroMedians[gid]
      .map((v, i) => [ymToNum(D.heroMonths[i]), v])
      .filter(p => p[1] !== null);
    for (const p of pts) if (p[1] > clippedMax) { clippedMax = p[1]; clippedAt = p[0]; }
    el("path", {
      d: pathFrom(pts, x, y), fill: "none",
      stroke: GROUP_COLOR[gid], "stroke-width": gid === "high_inflation" ? 2 : 2.5,
      "stroke-dasharray": gid === "high_inflation" ? "5 4" : "none",
      "stroke-linejoin": "round",
    }, g);
  }
  if (clippedMax > YMAX) {
    el("text", {
      x: x(clippedAt), y: M.t + 14, "text-anchor": "middle",
      fill: GROUP_COLOR.high_inflation, "font-size": 12,
    }, svg).textContent = `↑ high-inflation outliers peak at ${clippedMax.toFixed(1)}% (median)`;
  }

  // invisible hover overlay
  const hover = el("rect", { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b, fill: "transparent" }, svg);
  const cursor = el("line", { y1: M.t, y2: H - M.b, stroke: "#5d6b7d", "stroke-width": 1, visibility: "hidden" }, svg);
  hover.addEventListener("mousemove", ev => {
    const box = svg.getBoundingClientRect();
    const tt = x.invert((ev.clientX - box.left) * (W / box.width));
    const p = numToYm(Math.min(Math.max(tt, t0), t1));
    const idx = D.heroMonths.indexOf(p);
    if (idx < 0) return;
    cursor.setAttribute("x1", x(ymToNum(p)));
    cursor.setAttribute("x2", x(ymToNum(p)));
    cursor.setAttribute("visibility", "visible");
    let html = `<div class="tt-title">${fmtMonth(p)} — median policy rate</div>`;
    for (const gid of D.groupOrder) {
      const v = D.heroMedians[gid][idx];
      if (v !== null) html += `<div class="tt-row"><span style="color:${GROUP_COLOR[gid]}">●</span> ${D.groups[gid].name}: <b>${v.toFixed(2)}%</b></div>`;
    }
    showTip(html, ev);
  });
  hover.addEventListener("mouseleave", () => { hideTip(); cursor.setAttribute("visibility", "hidden"); });

  const legend = document.getElementById("hero-legend");
  for (const gid of D.groupOrder) {
    const k = document.createElement("span");
    k.className = "key";
    k.innerHTML = `<span class="swatch" style="background:${GROUP_COLOR[gid]}"></span>${D.groups[gid].name}`;
    legend.appendChild(k);
  }
})();

/* ------------------------------------------------------- country stories */
const STORIES = {
  US: "The Fed was late to call the 2021 surge — then delivered the steepest hiking cycle since Volcker: <strong>{hikePP}pp in 16 months</strong>, and held the peak for over a year. Inflation fell from {peakCPI}% to ~3% without recession; cautious cuts began in late 2024.",
  XM: "The ECB exited eight years of negative rates in one summer. It moved a year after the EM central banks and months after the Fed — euro-area inflation was more energy-driven (Russian gas shock), which rate hikes can't fix directly. Cuts began June 2024, ahead of the Fed.",
  JP: "The great exception: the Bank of Japan <strong>kept its negative rate through the entire global tightening</strong>, betting the imported inflation spike was the chance to finally entrench 2% expectations after decades of deflation. Its first hike in 17 years came in March 2024.",
  GB: "The Bank of England was the first G7 mover (December 2021) and faced the worst of both worlds — a US-style tight labour market plus a European-style energy shock. UK inflation touched 11.1%, the highest in the G7.",
  CA: "The Bank of Canada moved fast and was among the first advanced economies to pause (early 2023) and to cut (June 2024) — its mortgage market passes rate changes to households unusually quickly, so policy bites fast.",
  AU: "The RBA hiked later and to a lower peak ({peak}%) than peers, explicitly choosing a slower path to protect employment — and Australia's quarterly CPI publication makes its reaction function visibly lumpier.",
  KR: "The Bank of Korea was the first major advanced economy to hike (August 2021), citing household debt and housing as much as consumer prices.",
  CH: "Switzerland is the masterclass in credibility: inflation never exceeded 3.5%, so the SNB peaked at just {peak}% — and used the strong franc as an anti-inflation tool. It was the first advanced cutter (March 2024) and was back at zero by 2025.",
  SE: "The Riksbank fought 10%+ inflation in a krona-weakened, rate-sensitive economy where most mortgages float — hikes transmitted brutally fast to households.",
  NO: "Norges Bank was an early, methodical hiker (September 2021) and one of the most reluctant cutters — oil revenues kept the economy hot.",
  NZ: "The RBNZ — the bank that invented inflation targeting in 1990 — hiked early (October 2021) and hard, then pivoted to some of the deepest cuts in the advanced world when the economy stalled.",
  IS: "Iceland was Western Europe's first hiker (May 2021) and rode its rate up to 9.25% — a small, volatile economy where the central bank moves early or loses the currency.",
  BR: "The poster child of EM orthodoxy: the BCB began hiking in <strong>March 2021, a full year before the Fed</strong>, dragging Selic from 2% to 13.75% in 17 months. It earned the right to cut early (August 2023) — then had to re-tighten in 2024-25 when fiscal worries reignited inflation expectations.",
  MX: "Banxico shadowed the Fed with a premium, hiking to {peak}% — a record — and held it until inflation was convincingly inside the corridor. Classic EM playbook: never let the rate differential with the US close.",
  CL: "Chile hiked from 0.5% to 11.25% in 15 months — one of the most aggressive cycles anywhere — and then cut just as decisively once inflation broke.",
  CO: "Colombia's hiking cycle peaked at 13.25%; with inflation peaking later than its neighbours, it was the last of the LatAm targeters to start easing.",
  PE: "Peru's central bank hiked early to a comparatively low 7.75% peak — and saw one of the fastest disinflations in the region: textbook small-economy inflation targeting.",
  PL: "Poland's NBP started hiking in October 2021, nine months before the ECB — CEE economies import euro-area inflation but add their own tight labour markets, so they consistently lead the ECB in both directions.",
  CZ: "The Czech National Bank was among Europe's earliest movers (June 2021), pushing rates to 7% — then held them there for 18 months, refusing to cut until inflation collapsed from 18% to 2% in a single year (2023→24).",
  HU: "Hungary ran the EU's highest inflation (over 25%) and its highest rate — a 13% base rate plus an 18% emergency overnight tool during the 2022 forint crisis. The orthodox toolkit, stretched to its limit.",
  RO: "Romania hiked more cautiously than its CEE peers and tolerated a longer disinflation — leaning on fiscal measures and a heavily managed leu.",
  ZA: "The SARB hiked from 3.5% to 8.25% even though South African inflation peaked under 8% — defending the rand and its 3–6% band's credibility cost growth it could ill afford.",
  IL: "The Bank of Israel ran a textbook cycle — early start, moderate 4.75% peak — then held rates through wartime fiscal expansion after October 2023.",
  IN: "The RBI hiked a moderate 2.5pp — Indian inflation peaked under 8% — and spent the cycle managing food-price spikes that monetary policy cannot reach, the chronic EM-Asia problem.",
  ID: "Bank Indonesia hiked late and least among major EMs: Indonesian inflation peaked under 6%, cushioned by fuel subsidies and price controls — fiscal tools doing the central bank's job.",
  TH: "Thailand's cycle peaked at just 2.5% — the lowest EM peak — because Thai inflation collapsed as fast as it rose; the bigger battle since has been against deflation, not inflation.",
  MY: "Malaysia, with no formal target, nudged rates up a token 1.25pp — administered fuel and food prices kept measured inflation among the world's lowest.",
  PH: "The BSP hiked 4.5pp including off-cycle emergency moves as rice-price inflation — half the Filipino CPI basket is food — kept headline inflation sticky.",
  TR: "The cautionary tale. President Erdoğan's doctrine that high rates <em>cause</em> inflation forced the central bank to <strong>cut from 19% to 8.5% while inflation climbed to 85%</strong> — a complete inversion of the global playbook, paid for in a collapsing lira. After the 2023 election, an orthodox team hiked to 50% in nine months. The U-turn is the sharpest 'V' in this entire dataset.",
  AR: "Argentina fought 200%+ inflation with rates above 100% — and lost, because the printing press was financing the deficit. The Milei government's December 2023 shock therapy (devaluation, fiscal surplus, then rapid rate cuts) inverted the logic: fix the fiscal source, and the rate can fall even from triple digits.",
  RU: "Two separate wars on the rouble: an emergency spike to 20% when sanctions hit in February 2022 (unwound within months), then a grinding climb to 21% — a two-decade high — as war spending overheated the economy. Sanctions make the policy rate one of the few stabilisers left.",
  CN: "The PBoC moved <strong>in the opposite direction to everyone</strong>: cutting through 2022–25 as a property bust pushed China toward deflation. Inflation never exceeded 3%. The managed yuan and capital controls give it the freedom to ignore the Fed.",
  SA: "SAMA's rate mirrors the Fed almost tick for tick — that is what a hard dollar peg means. Saudi inflation stayed near 3% anyway: administered fuel prices and a subsidised consumption basket absorb global shocks.",
  HK: "A currency board: Hong Kong's base rate is set by formula off the Fed funds rate, so it hiked 5.25pp into a local recession. The peg's discipline is exactly its point — and its price.",
  DK: "Denmark targets the euro, not Danish prices: the Nationalbank moves with (sometimes fractionally off) the ECB to hold the krone, whatever Danish inflation does. A reminder that a peg outsources your monetary policy.",
};

/* ------------------------------------------------------------- explorer */
const RANGES = [
  { label: "2019–25", start: 2019 },
  { label: "2008–25", start: 2008 },
  { label: "1995–25", start: 1995 },
  { label: "Max (1980–)", start: 1980 },
];
let currentIso = "US";
let currentRange = 0;

function inflationSegments(c, tMin, tMax) {
  /* Returns {monthly:[[t,v]], annualPre:[[t,v]], annualPost:[[t,v]]} clipped to window. */
  const monthly = seriesPoints(c.cpiM).filter(p => p[0] >= tMin && p[0] <= tMax);
  const mFirst = c.cpiM ? ymToNum(c.cpiM.start) : Infinity;
  const mLastArr = seriesPoints(c.cpiM);
  const mLast = mLastArr.length ? mLastArr[mLastArr.length - 1][0] : -Infinity;
  const annualPre = [], annualPost = [];
  for (const yStr in c.cpiA) {
    const v = c.cpiA[yStr];
    if (v === null) continue;
    const t = +yStr + 0.5; // mid-year
    if (t < tMin || t > tMax) continue;
    if (t < mFirst) annualPre.push([t, v]);
    else if (t > mLast) annualPost.push([t, v]);
  }
  annualPre.sort((a, b) => a[0] - b[0]);
  annualPost.sort((a, b) => a[0] - b[0]);
  // bridge: connect annualPre -> first monthly, last monthly -> annualPost
  if (annualPre.length && monthly.length) annualPre.push(monthly[0]);
  if (annualPost.length && monthly.length) annualPost.unshift(monthly[monthly.length - 1]);
  return { monthly, annualPre, annualPost };
}

function drawExplorer() {
  const c = D.countries[currentIso];
  const color = GROUP_COLOR[c.group];
  const host = document.getElementById("explorer-chart");
  host.innerHTML = "";

  const W = 960, H = 430, M = { l: 50, r: 16, t: 16, b: 28 };
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}` }, host);

  const tMin = RANGES[currentRange].start;
  const tMax = ymToNum(D.meta.rateEnd) + 1 / 12;

  const ratePts = seriesPoints(c.rate).filter(p => p[0] >= tMin && p[0] <= tMax);
  const inf = inflationSegments(c, tMin, tMax);
  const allVals = [
    ...ratePts.map(p => p[1]),
    ...inf.monthly.map(p => p[1]),
    ...inf.annualPre.map(p => p[1]),
    ...inf.annualPost.map(p => p[1]),
  ];
  let lo = Math.min(0, ...allVals), hi = Math.max(4, ...allVals);
  const padV = (hi - lo) * 0.06;
  lo = Math.min(0, lo - padV); hi += padV;

  const x = lin([tMin, tMax], [M.l, W - M.r]);
  const y = lin([lo, hi], [H - M.b, M.t]);

  // target band
  if (c.band) {
    const [b0, b1] = c.band;
    const yTop = y(Math.min(b1 + (b0 === b1 ? 0.25 : 0), hi));
    const yBot = y(Math.max(b0 - (b0 === b1 ? 0.25 : 0), lo));
    el("rect", { x: M.l, y: yTop, width: W - M.l - M.r, height: Math.max(yBot - yTop, 0), fill: "#58d68d18" }, svg);
    el("text", { x: W - M.r - 4, y: yTop - 4, "text-anchor": "end", fill: "#58d68d99", "font-size": 10.5 }, svg)
      .textContent = `target ${c.target}`;
  }

  // grid + axes
  for (const v of niceTicks(lo, hi, 6)) {
    el("line", { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: "grid-line", "stroke-dasharray": v === 0 ? "none" : "2 4", stroke: v === 0 ? "#3a4a60" : undefined }, svg);
    el("text", { x: M.l - 8, y: y(v) + 4, "text-anchor": "end", class: "axis-label" }, svg).textContent = v + "%";
  }
  const span = tMax - tMin;
  const yearStep = span > 30 ? 10 : span > 16 ? 5 : span > 8 ? 2 : 1;
  for (let yr = Math.ceil(tMin / yearStep) * yearStep; yr <= tMax; yr += yearStep) {
    el("line", { x1: x(yr), x2: x(yr), y1: H - M.b, y2: H - M.b + 4, stroke: "#5d6b7d" }, svg);
    el("text", { x: x(yr), y: H - 8, "text-anchor": "middle", class: "axis-label" }, svg).textContent = yr;
  }

  // inflation: monthly solid + annual dashed with diamonds
  if (inf.annualPre.length > 1) el("path", { d: pathFrom(inf.annualPre, x, y), fill: "none", stroke: CPI_COLOR, "stroke-width": 1.6, "stroke-dasharray": "3 5", opacity: 0.8 }, svg);
  if (inf.annualPost.length > 1) el("path", { d: pathFrom(inf.annualPost, x, y), fill: "none", stroke: CPI_COLOR, "stroke-width": 1.6, "stroke-dasharray": "3 5", opacity: 0.8 }, svg);
  for (const seg of [inf.annualPre.slice(0, -1), inf.annualPost.slice(1)]) {
    for (const [t, v] of seg) {
      el("rect", { x: x(t) - 3, y: y(v) - 3, width: 6, height: 6, transform: `rotate(45 ${x(t)} ${y(v)})`, fill: CPI_COLOR, opacity: 0.9 }, svg);
    }
  }
  if (inf.monthly.length > 1) {
    el("path", { d: pathFrom(inf.monthly, x, y), fill: "none", stroke: CPI_COLOR, "stroke-width": 1.7, opacity: 0.92, "stroke-linejoin": "round" }, svg);
  }

  // policy rate as step line
  if (ratePts.length) {
    let d = `M${x(ratePts[0][0]).toFixed(1)},${y(ratePts[0][1]).toFixed(1)}`;
    for (let i = 1; i < ratePts.length; i++) {
      d += `H${x(ratePts[i][0]).toFixed(1)}V${y(ratePts[i][1]).toFixed(1)}`;
    }
    el("path", { d, fill: "none", stroke: color, "stroke-width": 2.4, "stroke-linejoin": "round" }, svg);
  }

  // series legend (inline, top-left)
  const lg = el("g", {}, svg);
  el("line", { x1: M.l + 10, x2: M.l + 34, y1: M.t + 8, y2: M.t + 8, stroke: color, "stroke-width": 2.4 }, lg);
  el("text", { x: M.l + 40, y: M.t + 12, fill: "#93a1b3", "font-size": 12 }, lg).textContent = "Policy rate";
  el("line", { x1: M.l + 130, x2: M.l + 154, y1: M.t + 8, y2: M.t + 8, stroke: CPI_COLOR, "stroke-width": 1.7 }, lg);
  el("text", { x: M.l + 160, y: M.t + 12, fill: "#93a1b3", "font-size": 12 }, lg).textContent = "Inflation (YoY)";

  // hover crosshair
  const monthlyByT = new Map(inf.monthly.map(p => [numToYm(p[0]), p[1]]));
  const rateByT = new Map(ratePts.map(p => [numToYm(p[0]), p[1]]));
  const cursor = el("line", { y1: M.t, y2: H - M.b, stroke: "#5d6b7d", visibility: "hidden" }, svg);
  const hover = el("rect", { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b, fill: "transparent" }, svg);
  hover.addEventListener("mousemove", ev => {
    const box = svg.getBoundingClientRect();
    const t = x.invert((ev.clientX - box.left) * (W / box.width));
    const p = numToYm(Math.min(Math.max(t, tMin), tMax - 1 / 12));
    cursor.setAttribute("x1", x(ymToNum(p)));
    cursor.setAttribute("x2", x(ymToNum(p)));
    cursor.setAttribute("visibility", "visible");
    const r = rateByT.get(p);
    const i = monthlyByT.get(p);
    const yr = p.slice(0, 4);
    const a = c.cpiA[yr];
    let html = `<div class="tt-title">${fmtMonth(p)}</div>`;
    html += `<div class="tt-row">Policy rate: <b>${r !== undefined ? r.toFixed(2) + "%" : "–"}</b></div>`;
    if (i !== undefined) html += `<div class="tt-row">Inflation: <b>${i.toFixed(1)}%</b> y/y</div>`;
    else if (a !== undefined && a !== null) html += `<div class="tt-row">Inflation ${yr} (annual avg): <b>${a.toFixed(1)}%</b></div>`;
    showTip(html, ev);
  });
  hover.addEventListener("mouseleave", () => { hideTip(); cursor.setAttribute("visibility", "hidden"); });

  // header, note, stats, story
  document.getElementById("country-title").innerHTML =
    `<h3 style="color:${color}">${c.name}</h3><div class="sub">${c.bank} · ${D.groups[c.group].name} · target: ${c.target}</div>`;

  const notes = [];
  if (c.cpiQuarterly) notes.push("Australia publishes CPI quarterly — the inflation line connects quarter-end readings.");
  if (currentIso === "XM") notes.push("Euro-area monthly HICP shown from 2020 (Eurostat); earlier years at annual resolution (dashed).");
  if (D.latestKnown[currentIso]) {
    const lk = D.latestKnown[currentIso];
    notes.push(`Beyond the chart: ${lk.rate.toFixed(2)}% as of ${lk.date} (BIS bulk data, May 2026).`);
  }
  notes.push("Dashed inflation segments are annual averages (BIS long series).");
  document.getElementById("explorer-note").textContent = notes.join(" ");

  const s = c.stats;
  const cards = [];
  if (s.latest !== null && s.latest !== undefined) cards.push([s.latest.toFixed(2) + "%", "policy rate", fmtMonth(s.latestP)]);
  if (s.peakCPI !== null) cards.push([s.peakCPI.toFixed(1) + "%", "peak inflation", s.peakCPIP.length === 4 ? s.peakCPIP + " (avg)" : fmtMonth(s.peakCPIP)]);
  if (s.hikePP !== null && s.hikePP > 0) cards.push(["+" + s.hikePP.toFixed(2) + "pp", "total tightening", `${s.trough}% → ${s.peak}%`]);
  if (s.firstHike) cards.push([fmtMonth(s.firstHike), "first hike", "of the 2020s cycle"]);
  if (s.cutPP !== null && s.cutPP > 0.01) cards.push(["−" + s.cutPP.toFixed(2) + "pp", "cut from peak", `peak ${fmtMonth(s.peakP)}`]);
  if (c.lagCorr) cards.push([c.lagCorr.lag + " mo", "inflation→rate lag", `best corr r=${c.lagCorr.r} (2010–22)`]);
  document.getElementById("stat-cards").innerHTML = cards.map(([v, k, d]) =>
    `<div class="stat"><div class="v">${v}</div><div class="k">${k}</div><div class="d">${d}</div></div>`).join("");

  const storyHost = document.getElementById("country-story");
  let story = STORIES[currentIso] || "";
  story = story.replace(/\{(\w+)\}/g, (_, k) => {
    const v = s[k];
    return v === null || v === undefined ? "—" : (typeof v === "number" ? (Math.abs(v) % 1 ? v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") : String(v)) : v);
  });
  storyHost.style.borderLeftColor = color;
  storyHost.innerHTML = story || `<strong>${c.bank}</strong>: ${D.groups[c.group].desc}`;
}

(function buildPicker() {
  const host = document.getElementById("country-picker");
  for (const gid of D.groupOrder) {
    const div = document.createElement("div");
    div.className = "picker-group";
    div.innerHTML = `<div class="pg-label" style="color:${GROUP_COLOR[gid]}">${D.groups[gid].name}</div>`;
    const chips = document.createElement("div");
    chips.className = "pg-chips";
    for (const iso of D.countryOrder) {
      const c = D.countries[iso];
      if (c.group !== gid) continue;
      const b = document.createElement("button");
      b.className = "cbtn";
      b.dataset.iso = iso;
      b.textContent = c.name;
      b.addEventListener("click", () => { currentIso = iso; refreshPicker(); drawExplorer(); });
      chips.appendChild(b);
    }
    div.appendChild(chips);
    host.appendChild(div);
  }
  const rb = document.getElementById("range-buttons");
  RANGES.forEach((r, i) => {
    const b = document.createElement("button");
    b.className = "rbtn" + (i === currentRange ? " active" : "");
    b.textContent = r.label;
    b.addEventListener("click", () => {
      currentRange = i;
      rb.querySelectorAll(".rbtn").forEach((n, j) => n.classList.toggle("active", j === i));
      drawExplorer();
    });
    rb.appendChild(b);
  });
  refreshPicker();
})();

function refreshPicker() {
  document.querySelectorAll(".cbtn").forEach(b => {
    const active = b.dataset.iso === currentIso;
    b.classList.toggle("active", active);
    b.style.background = active ? GROUP_COLOR[D.countries[b.dataset.iso].group] : "";
  });
}
drawExplorer();

/* --------------------------------------------------------------- scatter */
(function scatter() {
  const host = document.getElementById("scatter-chart");
  const W = 960, H = 480, M = { l: 56, r: 24, t: 18, b: 44 };
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}` }, host);

  const pts = [];
  for (const iso of D.countryOrder) {
    const c = D.countries[iso];
    const s = c.stats;
    if (s.peakCPI === null || s.peakCPI === undefined || s.hikePP === null) continue;
    pts.push({ iso, c, x: Math.max(s.peakCPI, 1), y: Math.max(s.hikePP, 0.15), zero: s.hikePP < 0.15 });
  }
  const x = logScale([1, 400], [M.l, W - M.r]);
  const y = logScale([0.12, 120], [H - M.b, M.t]);

  for (const v of [1, 2, 5, 10, 20, 50, 100, 200, 400]) {
    el("line", { x1: x(v), x2: x(v), y1: M.t, y2: H - M.b, class: "grid-line" }, svg);
    el("text", { x: x(v), y: H - M.b + 16, "text-anchor": "middle", class: "axis-label" }, svg).textContent = v + "%";
  }
  for (const v of [0.25, 0.5, 1, 2, 5, 10, 25, 50, 100]) {
    el("line", { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: "grid-line" }, svg);
    el("text", { x: M.l - 8, y: y(v) + 4, "text-anchor": "end", class: "axis-label" }, svg).textContent = v;
  }
  el("text", { x: (M.l + W - M.r) / 2, y: H - 6, "text-anchor": "middle", class: "axis-label" }, svg)
    .textContent = "Peak inflation faced, 2021–24 (year-on-year %, log scale)";
  el("text", { x: 14, y: (M.t + H - M.b) / 2, class: "axis-label", transform: `rotate(-90 14 ${(M.t + H - M.b) / 2})`, "text-anchor": "middle" }, svg)
    .textContent = "Policy-rate tightening, trough → peak (pp, log scale)";

  for (const p of pts) {
    const col = GROUP_COLOR[p.c.group];
    const cx = x(p.x), cy = y(p.y);
    const r = 6 + Math.sqrt(Math.max(p.c.stats.peak || 0, 0)) * 1.4;
    const dot = el("circle", { cx, cy, r, fill: col + "55", stroke: col, "stroke-width": 1.6, cursor: "pointer" }, svg);
    el("text", { x: cx, y: cy - r - 4, "text-anchor": "middle", fill: col, "font-size": 11, "font-weight": 600 }, svg).textContent = p.iso;
    dot.addEventListener("mousemove", ev => {
      const s = p.c.stats;
      showTip(
        `<div class="tt-title">${p.c.name}</div>
         <div class="tt-row">Peak inflation: <b>${s.peakCPI.toFixed(1)}%</b> (${s.peakCPIP.length === 4 ? s.peakCPIP : fmtMonth(s.peakCPIP)})</div>
         <div class="tt-row">Tightening: <b>${p.zero ? "≈0" : "+" + s.hikePP.toFixed(2)}pp</b> (${s.trough}% → ${s.peak}%)</div>
         <div class="tt-row">Peak rate: <b>${s.peak}%</b> ${s.peakP ? "in " + fmtMonth(s.peakP) : ""}</div>`, ev);
    });
    dot.addEventListener("mouseleave", hideTip);
  }

  const legend = document.getElementById("scatter-legend");
  for (const gid of D.groupOrder) {
    const k = document.createElement("span");
    k.className = "key";
    k.innerHTML = `<span class="swatch" style="background:${GROUP_COLOR[gid]};height:10px;width:10px;border-radius:50%"></span>${D.groups[gid].name}`;
    legend.appendChild(k);
  }
  const note = document.createElement("span");
  note.className = "key";
  note.style.color = "#5d6b7d";
  note.textContent = "bubble size = peak policy rate · China sits at the floor: it cut, not hiked";
  legend.appendChild(note);
})();

/* -------------------------------------------------------------- lag bars */
(function lagBars() {
  const host = document.getElementById("lag-chart");
  const rows = D.countryOrder
    .map(iso => ({ iso, c: D.countries[iso], l: D.countries[iso].lagCorr }))
    .filter(r => r.l)
    .sort((a, b) => a.l.lag - b.l.lag || b.l.r - a.l.r);

  const W = 960, rowH = 21, M = { l: 120, r: 70, t: 8, b: 26 };
  const H = M.t + rows.length * rowH + M.b;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}` }, host);
  const x = lin([0, 24], [M.l, W - M.r]);

  for (const v of [0, 6, 12, 18, 24]) {
    el("line", { x1: x(v), x2: x(v), y1: M.t, y2: H - M.b, class: "grid-line" }, svg);
    el("text", { x: x(v), y: H - 8, "text-anchor": "middle", class: "axis-label" }, svg).textContent = v + " mo";
  }

  rows.forEach((r, i) => {
    const cy = M.t + i * rowH + rowH / 2;
    const col = GROUP_COLOR[r.c.group];
    const alpha = Math.max(0.25, Math.min(1, Math.abs(r.l.r)));
    el("text", { x: M.l - 8, y: cy + 4, "text-anchor": "end", fill: "#93a1b3", "font-size": 12 }, svg).textContent = r.c.name;
    const bar = el("rect", {
      x: x(0), y: cy - 6, width: Math.max(x(r.l.lag) - x(0), 2), height: 12,
      rx: 3, fill: col, opacity: alpha, cursor: "pointer",
    }, svg);
    const inside = r.l.lag >= 20;
    el("text", {
      x: inside ? x(r.l.lag) - 6 : x(r.l.lag) + 6, y: cy + 4,
      "text-anchor": inside ? "end" : "start",
      fill: inside ? "#0c1118" : "#5d6b7d", "font-size": 11,
      "font-weight": inside ? 600 : 400, "pointer-events": "none",
    }, svg).textContent = `${r.l.lag} mo · r=${r.l.r.toFixed(2)}`;
    bar.addEventListener("mousemove", ev => showTip(
      `<div class="tt-title">${r.c.name}</div>
       <div class="tt-row">Policy rate correlates best with inflation <b>${r.l.lag} months earlier</b> (r = ${r.l.r}, monthly levels 2010–22).</div>`, ev));
    bar.addEventListener("mouseleave", hideTip);
  });
})();

/* ------------------------------------------------------------ group cards */
(function groupCards() {
  const host = document.getElementById("group-cards");
  const median = a => {
    const v = a.filter(x => x !== null && x !== undefined).sort((p, q) => p - q);
    if (!v.length) return null;
    return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  };
  const INSIGHT = {
    majors: "All seven hiked into restrictive territory for the first time since 2007 and — Japan apart — got inflation back near target by 2024 without the recession most forecasters expected. The cutting cycle that began in 2024 has been deliberately slower than the hiking cycle.",
    small_open: "Small open economies imported the shock through energy prices and exchange rates. They moved earlier than the majors (Norway Sep 2021, Iceland May 2021), peaked lower where credibility was strong (Switzerland 1.75%), and cut first — the SNB led the entire advanced world down in March 2024.",
    em_target: "The quiet vindication of two decades of EM inflation targeting: Brazil, Chile and the CEE banks hiked up to a year before the Fed, paid the growth cost upfront, and were rewarded with early disinflation and early cuts — without the currency crises that defined past Fed cycles.",
    high_inflation: "Where the framework itself failed or was overridden: Türkiye's experiment in cutting against inflation, Argentina's monetised deficits, Russia's sanctions economy. All three ended up with the highest rates in the dataset — orthodoxy reasserted, at a price.",
    pegged: "No independent monetary policy here: Saudi Arabia and Hong Kong imported 525bp of Fed hikes regardless of local conditions, Denmark shadowed the ECB. China is the exception that proves the rule — capital controls let the PBoC cut into a deflationary property bust while the world tightened.",
  };

  for (const gid of D.groupOrder) {
    const members = D.countryOrder.filter(i => D.countries[i].group === gid).map(i => D.countries[i]);
    const col = GROUP_COLOR[gid];
    const medHike = median(members.map(c => c.stats.hikePP));
    const medPeakCpi = median(members.map(c => c.stats.peakCPI));
    const med2024 = median(members.map(c => c.cpiA["2024"]));
    const medPeakRate = median(members.map(c => c.stats.peak));

    const card = document.createElement("div");
    card.className = "gcard";
    card.style.borderLeftColor = col;

    // dumbbell: peak cpi -> 2024 cpi on a log-ish scale 0..max
    const dbW = 560, dbH = 34;
    const maxV = Math.max(medPeakCpi || 1, 12);
    const dx = lin([0, maxV * 1.15], [0, dbW]);
    const dumbbell = `
      <svg viewBox="0 0 ${dbW + 150} ${dbH}" style="max-width:${dbW + 150}px">
        <line x1="${dx(med2024 ?? 0)}" x2="${dx(medPeakCpi ?? 0)}" y1="17" y2="17" stroke="${col}" stroke-width="3" opacity="0.5"/>
        <circle cx="${dx(medPeakCpi ?? 0)}" cy="17" r="7" fill="none" stroke="${col}" stroke-width="2.5"/>
        <circle cx="${dx(med2024 ?? 0)}" cy="17" r="7" fill="${col}"/>
        <text x="${dx(medPeakCpi ?? 0)}" y="9" text-anchor="middle" fill="${col}" font-size="11">peak ${medPeakCpi?.toFixed(1)}%</text>
        <text x="${dx(med2024 ?? 0)}" y="32" text-anchor="middle" fill="#93a1b3" font-size="11">2024: ${med2024?.toFixed(1)}%</text>
        <text x="${dbW + 10}" y="21" fill="#5d6b7d" font-size="11">median inflation</text>
      </svg>`;

    card.innerHTML = `
      <h3 style="color:${col}">${D.groups[gid].name}</h3>
      <p class="gdesc">${D.groups[gid].desc}</p>
      <div class="gmembers">${members.map(m => m.name).join(" · ")}</div>
      ${dumbbell}
      <div class="gstats">Median tightening <b>${medHike !== null ? "+" + medHike.toFixed(1) + "pp" : "—"}</b>
        · median peak rate <b>${medPeakRate !== null ? medPeakRate.toFixed(2) + "%" : "—"}</b></div>
      <div class="gstats">${INSIGHT[gid]}</div>`;
    host.appendChild(card);
  }
})();

/* fill data-vintage spans in methodology */
document.querySelectorAll(".data-end").forEach(n => {
  n.textContent = fmtMonth(D.meta[n.dataset.k]);
});
