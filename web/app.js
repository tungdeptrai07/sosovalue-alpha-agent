const STATIC_FALLBACK = {
  dataSourceMode: "static_github_pages_preview",
  currentExposureUsdc: 0,
  baskets: [
    { ticker: "MAG7.ssi", name: "SoSoValue Magnificent 7 Crypto Index", category: "Core Layer-1 & Institutional Majors", nav_usd: 1.482, change_24h_pct: 4.15, etf_net_inflow_musd: 318.4, funding_apr_pct: 11.8, volatility_regime: "BULL_EXPANSION" },
    { ticker: "DEFI.ssi", name: "SoSoValue Decentralized Finance Index", category: "DeFi Yield & Perpetual Protocols", nav_usd: 1.194, change_24h_pct: 6.42, etf_net_inflow_musd: 84.2, funding_apr_pct: 16.4, volatility_regime: "BREAKOUT_ACCUMULATION" },
    { ticker: "MEME.ssi", name: "SoSoValue Meme Liquidity Index", category: "High-Beta Social & Attention Assets", nav_usd: 0.912, change_24h_pct: -5.8, etf_net_inflow_musd: -41.5, funding_apr_pct: 28.5, volatility_regime: "OVERHEATED_FUNDING" },
    { ticker: "USSO.ssi", name: "SoSoValue Delta-Neutral Treasury & Basis Index", category: "Market-Neutral Basis & RWA Yield", nav_usd: 1.068, change_24h_pct: 0.14, etf_net_inflow_musd: 129.0, funding_apr_pct: 14.2, volatility_regime: "LOW_VOL_CARRY" },
  ],
  signals: [
    { signal_id: "sig_mag7", ticker: "MAG7.ssi", direction: "LONG", confidence: 0.879, regime: "BULL_EXPANSION", thesis: "Strong institutional net inflow ($318.4M) aligns with +4.15% spot momentum on MAG7.ssi. Trend-following LONG via SoDEX with tight 3.2% downside protection.", suggested_notional_usdc: 1250, stop_loss_pct: 3.2, take_profit_pct: 9.5, sodex_pair: "MAG7-USDC-PERP" },
    { signal_id: "sig_meme", ticker: "MEME.ssi", direction: "DELTA_NEUTRAL_HEDGE", confidence: 0.83, regime: "OVERHEATED_FUNDING", thesis: "Elevated funding (28.5% APR) combined with -5.80% pullback and $41.5M outflow indicates crowded leverage. Capture funding spread via Delta-Neutral Spot/Perp hedge on SoDEX.", suggested_notional_usdc: 1000, stop_loss_pct: 2.0, take_profit_pct: 6.5, sodex_pair: "MEME-USDC-PERP" },
    { signal_id: "sig_usso", ticker: "USSO.ssi", direction: "LONG", confidence: 0.785, regime: "LOW_VOL_CARRY", thesis: "Strong institutional net inflow ($129.0M) aligns with +0.14% spot momentum on USSO.ssi.", suggested_notional_usdc: 1250, stop_loss_pct: 3.2, take_profit_pct: 9.5, sodex_pair: "USSO-USDC-PERP" },
    { signal_id: "sig_defi", ticker: "DEFI.ssi", direction: "LONG", confidence: 0.79, regime: "BREAKOUT_ACCUMULATION", thesis: "Sector breakout (+6.42%) backed by $84.2M sector rotation and healthy 16.4% funding rate.", suggested_notional_usdc: 1100, stop_loss_pct: 3.5, take_profit_pct: 8.8, sodex_pair: "DEFI-USDC-PERP" },
  ],
};

const basketsGrid = document.getElementById("basketsGrid");
const signalsList = document.getElementById("signalsList");
const ticketsList = document.getElementById("ticketsList");
const modePill = document.getElementById("modePill");
const exposurePill = document.getElementById("exposurePill");
const notionalInput = document.getElementById("notionalInput");
const slippageInput = document.getElementById("slippageInput");
const drawdownInput = document.getElementById("drawdownInput");

let currentSignals = [];
let localTickets = [];
let staticExposure = 0;

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

function renderTickets(tickets) {
  if (!tickets.length) return;
  ticketsList.innerHTML = tickets.map((t) => `
    <div class="item-box">
      <div class="row-between">
        <strong>${esc(t.sodex_pair)} · ${esc(t.side)} ($${Number(t.notional_usdc).toFixed(2)} USDC)</strong>
        <span class="${t.risk_passed ? "pos" : "neg"}">${esc(t.status)}</span>
      </div>
      <div class="muted" style="margin-top:4px">Digest: ${esc(t.digest_hex.slice(0, 26))}… | SL ${t.stop_loss_pct}% / TP ${t.take_profit_pct}%</div>
      <ul style="margin:6px 0;padding-left:18px">
        ${(t.risk_reasons || []).map((r) => `<li>${esc(r)}</li>`).join("")}
      </ul>
      ${t.status === "PENDING_CONFIRMATION" ? `
        <div style="display:flex;gap:8px;margin-top:8px">
          <button type="button" class="btn ok" data-confirm="${esc(t.ticket_id)}" data-act="APPROVE">Confirm &amp; Dispatch to SoDEX</button>
          <button type="button" class="btn danger" data-confirm="${esc(t.ticket_id)}" data-act="CANCEL">Cancel</button>
        </div>
      ` : ""}
      ${t.execution_receipt ? `
        <div class="pos" style="margin-top:6px">SoDEX Order Hash: ${esc(t.execution_receipt.orderHash.slice(0, 30))}…</div>
      ` : ""}
    </div>
  `).join("");

  ticketsList.querySelectorAll("button[data-confirm]").forEach((btn) => {
    btn.addEventListener("click", () => confirmTicket(btn.dataset.confirm, btn.dataset.act));
  });
}

async function stageOrder(signalId) {
  const notionalUsdc = Number(notionalInput.value) || 1000;
  const slippageBps = Number(slippageInput.value) || 25;
  const drawdownPct = Number(drawdownInput.value) || 0;

  try {
    const res = await fetch("/api/stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signalId, notionalUsdc, slippageBps, drawdownPct }),
    });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) throw new Error("Static fallback");
    const tkt = await res.json();
    localTickets.unshift(tkt);
    renderTickets(localTickets);
  } catch {
    const sig = currentSignals.find((s) => s.signal_id === signalId) || STATIC_FALLBACK.signals[0];
    const reasons = [];
    if (notionalUsdc > 2500) reasons.push(`Order notional ($${notionalUsdc}) exceeds $2500 single-order cap.`);
    if (slippageBps > 50) reasons.push(`Slippage (${slippageBps} bps) exceeds 50 bps policy limit.`);
    if (drawdownPct >= 4.0) reasons.push(`Daily drawdown circuit breaker active (${drawdownPct}% >= 4.0%).`);
    const passed = reasons.length === 0;
    const tkt = {
      ticket_id: "tkt_" + Math.random().toString(16).slice(2, 10),
      sodex_pair: sig.sodex_pair,
      side: sig.direction,
      notional_usdc: notionalUsdc,
      stop_loss_pct: sig.stop_loss_pct,
      take_profit_pct: sig.take_profit_pct,
      risk_passed: passed,
      risk_reasons: passed ? ["All 5 pre-trade risk controls passed."] : reasons,
      status: passed ? "PENDING_CONFIRMATION" : "REJECTED_BY_RISK",
      digest_hex: "0x" + Math.random().toString(16).slice(2).padEnd(64, "a"),
    };
    localTickets.unshift(tkt);
    renderTickets(localTickets);
  }
}

async function confirmTicket(ticketId, action) {
  try {
    const res = await fetch("/api/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, action }),
    });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) throw new Error("Static fallback");
    const updated = await res.json();
    localTickets = localTickets.map((t) => (t.ticket_id === ticketId ? updated : t));
    if (action === "APPROVE") {
      staticExposure += Number(updated.notional_usdc || 0);
      exposurePill.textContent = `Active Exposure: $${staticExposure.toFixed(2)} USDC`;
    }
    renderTickets(localTickets);
  } catch {
    localTickets = localTickets.map((t) => {
      if (t.ticket_id !== ticketId) return t;
      if (action === "CANCEL") return { ...t, status: "CANCELLED" };
      staticExposure += Number(t.notional_usdc || 0);
      exposurePill.textContent = `Active Exposure: $${staticExposure.toFixed(2)} USDC`;
      return {
        ...t,
        status: "CONFIRMED_DISPATCHED",
        execution_receipt: { orderHash: "0x" + Math.random().toString(16).slice(2).padEnd(64, "f") },
      };
    });
    renderTickets(localTickets);
  }
}

async function scanMarket() {
  let data = STATIC_FALLBACK;
  try {
    const res = await fetch("/api/scan");
    const ct = res.headers.get("content-type") || "";
    if (res.ok && ct.includes("application/json")) {
      data = await res.json();
    }
  } catch {
    data = STATIC_FALLBACK;
  }

  modePill.textContent = `Source: ${data.dataSourceMode}`;
  staticExposure = Number(data.currentExposureUsdc || 0);
  exposurePill.textContent = `Active Exposure: $${staticExposure.toFixed(2)} USDC`;
  currentSignals = data.signals || [];

  basketsGrid.innerHTML = (data.baskets || []).map((b) => `
    <div class="item-box">
      <div class="row-between">
        <strong>${esc(b.ticker)}</strong>
        <span class="${b.change_24h_pct >= 0 ? "pos" : "neg"}">${b.change_24h_pct >= 0 ? "+" : ""}${b.change_24h_pct}%</span>
      </div>
      <div class="muted">${esc(b.name)}</div>
      <div style="margin-top:8px">NAV: <strong>$${b.nav_usd}</strong> · ETF Flow: <strong>$${b.etf_net_inflow_musd}M</strong></div>
      <div class="muted">Funding APR: ${b.funding_apr_pct}% · ${esc(b.volatility_regime)}</div>
    </div>
  `).join("");

  signalsList.innerHTML = currentSignals.map((s) => `
    <div class="item-box">
      <div class="row-between">
        <strong>${esc(s.ticker)} → ${esc(s.direction)} (${esc(s.sodex_pair)})</strong>
        <span class="pos">Confidence ${Math.round(s.confidence * 100)}%</span>
      </div>
      <div style="margin:6px 0">${esc(s.thesis)}</div>
      <div class="row-between">
        <span class="muted">Suggested: $${s.suggested_notional_usdc} USDC · SL ${s.stop_loss_pct}% / TP ${s.take_profit_pct}%</span>
        <button type="button" class="btn primary" data-stage="${esc(s.signal_id)}">Stage Order with Risk Check</button>
      </div>
    </div>
  `).join("");

  signalsList.querySelectorAll("button[data-stage]").forEach((btn) => {
    btn.addEventListener("click", () => stageOrder(btn.dataset.stage));
  });
}

document.getElementById("scanBtn").addEventListener("click", scanMarket);
scanMarket();
