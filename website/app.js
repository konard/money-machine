/* global document, window, history */

const state = { all: [], filtered: [] };

const el = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const money = (n) =>
  n === null || n === undefined ? '—' : `$${Number(n).toLocaleString('en-US')}`;
const days = (r) =>
  r.min === r.max ? `${esc(r.min)} d` : `${esc(r.min)}–${esc(r.max)} d`;

function bar(label, value, max = 10) {
  const w = Math.round((value / max) * 100);
  return `<div class="bar"><span>${label}</span><i style="--w:${w}%"></i><span>${value}</span></div>`;
}

function card(s) {
  const sc = s.scores;
  return `
  <article class="card" tabindex="0" data-id="${esc(s.id)}" role="button" aria-label="${esc(s.name)}">
    <div class="top">
      <span class="rank">#${s.rank}</span>
      <span class="tier tier-${s.tier}">Tier ${s.tier}</span>
      ${s.needsVerification ? '<span class="warn" title="Some payout figures unverified">⚠ unverified</span>' : ''}
      <span class="score" title="Priority score">${s.priorityScore}</span>
    </div>
    <span class="cat">${esc(s.categoryLabel)}</span>
    <h3>${esc(s.name)}</h3>
    <p>${esc(s.summary)}</p>
    <div class="bars">
      ${bar('Pay prob.', sc.paymentProbability)}
      ${bar('Automation', sc.automation)}
      ${bar('Income', sc.incomePotential)}
      ${bar('AI leverage', sc.aiLeverage)}
    </div>
    <div class="meta">
      <span>Median ${money(s.typicalMonthlyIncomeUsd.median)}/mo</span>
      <span>Effort ${sc.setupEffort}/${sc.ongoingEffort}</span>
      <span>Start ${s.startupCashUsd === null ? money(s.capitalRequiredUsd) : money(s.startupCashUsd)}</span>
      ${s.profitLikelihoodPercent === null ? '' : `<span title="Share of diligent starters reaching real net profit within 12 months (≥$100/mo where the plan can pay that much)">Profit odds ${s.profitLikelihoodPercent}%</span>`}
      <span>First $ ${days(s.timeToFirstDollarDays)}</span>
      <span>Legal ${sc.legalCoveragePercent}%</span>
    </div>
  </article>`;
}

function list(items) {
  return items.length
    ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
    : '<p>—</p>';
}

function businessPlan(bp) {
  if (!bp) {
    return '<h3>Resources & business plan</h3><p>Not yet compiled for this entry.</p>';
  }
  const sr = bp.startupResources || {};
  const ue = bp.unitEconomics || {};
  const be = bp.breakEven || {};
  const mc = bp.marketConditions || {};
  const range = (r) =>
    r ? `${money(r.low)} / ${money(r.median)} / ${money(r.high)}` : '—';
  return `
    <h3>What you need to start</h3>
    <table>
      <tr><td>Time to launch</td><td>${esc(sr.timeHoursToLaunch)} hours</td></tr>
      <tr><td>One-time cash</td><td>${money(sr.cashUsd)}</td></tr>
      <tr><td>Recurring fixed cost</td><td>${money(sr.recurringMonthlyUsd)}/mo</td></tr>
      <tr><td>Tools</td><td>${esc((sr.tools || []).join('; ') || '—')}</td></tr>
      <tr><td>Skills</td><td>${esc((sr.skills || []).join('; ') || '—')}</td></tr>
      <tr><td>Equipment</td><td>${esc((sr.equipment || []).join('; ') || '—')}</td></tr>
      <tr><td>Accounts</td><td>${esc((sr.accounts || []).join('; ') || '—')}</td></tr>
    </table>
    <h3>Unit economics</h3>
    <table>
      <tr><td>Unit</td><td>${esc(ue.unit)}</td></tr>
      <tr><td>Typical price (low / median / high)</td><td>${range(ue.typicalPriceUsd)}</td></tr>
      <tr><td>Direct cost per unit</td><td>${money(ue.costPerUnitUsd)}</td></tr>
      <tr><td>Platform fee</td><td>${esc(ue.platformFeePercent ?? 0)}%</td></tr>
      <tr><td>Gross margin (median)</td><td>${esc(ue.grossMarginPercent)}%</td></tr>
      <tr><td>Human hours per unit after automation</td><td>${esc(ue.hoursPerUnit)}</td></tr>
    </table>
    ${ue.notes ? `<p>${esc(ue.notes)}</p>` : ''}
    <h3>Break-even</h3>
    <table>
      <tr><td>Monthly fixed cost</td><td>${money(be.monthlyFixedCostUsd)}</td></tr>
      <tr><td>Units per month to break even</td><td>${esc(be.unitsPerMonthToBreakEven ?? 0)}</td></tr>
      <tr><td>Typical months to break even</td><td>${esc(be.typicalMonthsToBreakEven)}</td></tr>
      <tr><td>Months to recover startup cash</td><td>${esc(be.monthsToRecoverStartup ?? 0)}</td></tr>
    </table>
    ${be.notes ? `<p>${esc(be.notes)}</p>` : ''}
    <h3>Market conditions (Nov 2026)</h3>
    <table>
      <tr><td>Demand trend</td><td>${esc(mc.demandTrend)}</td></tr>
      <tr><td>Competition</td><td>${esc(mc.competition)}</td></tr>
      <tr><td>Effect of AI</td><td>${esc(mc.aiImpact)}</td></tr>
      <tr><td>Price pressure</td><td>${esc(mc.pricePressure)}</td></tr>
      <tr><td><b>Chance of real net profit within 12 months</b> (≥ $100/mo where the plan can pay that much)</td><td><b>${esc(mc.profitLikelihoodPercent)}%</b></td></tr>
      <tr><td>Typical net profit at month 12 (low / median / high)</td><td>${range(mc.typicalNetProfitMonth12Usd)}</td></tr>
    </table>
    ${mc.notes ? `<p>${esc(mc.notes)}</p>` : ''}
    <h3>Pricing strategy</h3>
    <p>${esc(bp.pricingStrategy)}</p>
    <h3>Path to profit</h3>
    <ol>${(bp.profitPath || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
}

function detail(s) {
  const sc = s.scores;
  const inc = s.typicalMonthlyIncomeUsd;
  const p = s.payout || {};
  return `
    <span class="cat">${esc(s.categoryLabel)} · Rank #${s.rank} · Tier ${s.tier} · Score ${s.priorityScore}/100</span>
    <h2>${esc(s.name)}</h2>
    ${s.needsVerification ? '<p class="warn-box">⚠ Some payout figures in this entry could not be confirmed on an official page. Check the notes and sources before relying on it.</p>' : ''}
    <p>${esc(s.summary)}</p>
    <h3>How it works</h3>
    <p>${esc(s.howItWorks)}</p>
    <p><b>Platforms:</b> ${esc((s.platforms || []).join(', '))}</p>
    <h3>Scores</h3>
    <table>
      <tr><td>Payment probability within 6 months</td><td>${sc.paymentProbability}/10</td></tr>
      <tr><td>Automation after setup</td><td>${sc.automation}/10</td></tr>
      <tr><td>Setup effort (1 = trivial)</td><td>${sc.setupEffort}/10</td></tr>
      <tr><td>Ongoing effort (1 = none)</td><td>${sc.ongoingEffort}/10</td></tr>
      <tr><td>Income potential</td><td>${sc.incomePotential}/10</td></tr>
      <tr><td>AI leverage</td><td>${sc.aiLeverage}/10</td></tr>
      <tr><td>Legal in reference countries</td><td>${sc.legalCoveragePercent}%</td></tr>
      <tr><td>Platform pays out in reference countries</td><td>${sc.platformAvailabilityPercent}%</td></tr>
      <tr><td>Capital required</td><td>${money(s.capitalRequiredUsd)}</td></tr>
      <tr><td>Time to first dollar</td><td>${days(s.timeToFirstDollarDays)}</td></tr>
      <tr><td>Typical monthly income (low / median / high)</td><td>${money(inc.low)} / ${money(inc.median)} / ${money(inc.high)}</td></tr>
    </table>
    ${businessPlan(s.businessPlan)}
    <h3>Payout path</h3>
    <ul>
      <li><b>Methods:</b> ${esc((p.methods || []).join(', '))}</li>
      <li><b>Minimum payout:</b> ${esc(p.minimumPayout)}</li>
      <li><b>Frequency:</b> ${esc(p.frequency)}</li>
      <li><b>Typical delay:</b> ${esc(p.typicalDelayDays)} days</li>
      ${p.notes ? `<li><b>Notes:</b> ${esc(p.notes)}</li>` : ''}
    </ul>
    <h3>Full cycle</h3>
    <ol>${(s.fullCycle || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
    <h3>What can be automated</h3>
    ${list(s.automationPlan || [])}
    <h3>Unavoidable manual steps</h3>
    ${list(s.manualSteps || [])}
    <h3>Legality & compliance</h3>
    <p>${esc(s.legality?.notes)}</p>
    ${s.legality?.restrictedIn?.length ? `<p><b>Restricted or banned in:</b> ${esc(s.legality.restrictedIn.join(', '))}</p>` : ''}
    <p><b>Compliance:</b> ${esc((s.legality?.complianceRequirements || []).join('; ')) || '—'}</p>
    ${s.availability?.notes ? `<p><b>Availability:</b> ${esc(s.availability.notes)}</p>` : ''}
    <h3>Risks</h3>
    ${list(s.risks || [])}
    <h3>Evidence that people get paid</h3>
    <p>${esc(s.evidence)}</p>
    <h3>Sources</h3>
    <ul>${(s.sources || []).map((u) => `<li><a href="${esc(u)}" rel="noopener" target="_blank">${esc(u)}</a></li>`).join('')}</ul>
    <p><a href="./plans/${esc(s.id)}.html">Open this plan as a page</a> · <a href="https://github.com/konard/money-machine/blob/main/docs/business-plans/${esc(s.id)}.md" target="_blank" rel="noopener">Markdown on GitHub</a></p>`;
}

const SORTERS = {
  priorityScore: (a, b) => b.priorityScore - a.priorityScore,
  paymentProbability: (a, b) =>
    b.scores.paymentProbability - a.scores.paymentProbability,
  automation: (a, b) => b.scores.automation - a.scores.automation,
  incomePotential: (a, b) =>
    b.scores.incomePotential - a.scores.incomePotential,
  aiLeverage: (a, b) => b.scores.aiLeverage - a.scores.aiLeverage,
  fastest: (a, b) => a.timeToFirstDollarDays.min - b.timeToFirstDollarDays.min,
  profitOdds: (a, b) =>
    (b.profitLikelihoodPercent ?? -1) - (a.profitLikelihoodPercent ?? -1),
  cheapest: (a, b) =>
    (a.startupCashUsd ?? a.capitalRequiredUsd) -
    (b.startupCashUsd ?? b.capitalRequiredUsd),
  lowEffort: (a, b) =>
    a.scores.setupEffort +
    a.scores.ongoingEffort -
    (b.scores.setupEffort + b.scores.ongoingEffort),
};

function apply() {
  const q = el('search').value.trim().toLowerCase();
  const cat = el('category').value;
  const tier = el('tier').value;
  const sort = el('sort').value;
  const zero = el('zeroCapital').checked;
  const auto = el('highAuto').checked;
  const maxCash = Number(el('maxCash').value);

  let items = state.all.filter((s) => {
    if (cat && s.category !== cat) {
      return false;
    }
    if (tier && s.tier !== tier) {
      return false;
    }
    if (zero && s.capitalRequiredUsd > 0) {
      return false;
    }
    if (auto && s.scores.automation < 7) {
      return false;
    }
    if (maxCash >= 0 && (s.startupCashUsd ?? s.capitalRequiredUsd) > maxCash) {
      return false;
    }
    if (q) {
      const hay = [
        s.name,
        s.summary,
        s.categoryLabel,
        ...(s.platforms || []),
        ...(s.tags || []),
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) {
        return false;
      }
    }
    return true;
  });
  items = items.slice().sort((a, b) => SORTERS[sort](a, b) || a.rank - b.rank);
  state.filtered = items;
  el('list').innerHTML = items.map(card).join('');
  el('empty').hidden = items.length > 0;
}

function stats(all) {
  const tiers = { S: 0, A: 0, B: 0, C: 0 };
  let zero = 0;
  let auto = 0;
  for (const s of all) {
    tiers[s.tier] += 1;
    if (s.capitalRequiredUsd === 0) {
      zero += 1;
    }
    if (s.scores.automation >= 7) {
      auto += 1;
    }
  }
  const items = [
    [all.length, 'strategies'],
    [tiers.S, 'tier S'],
    [tiers.A, 'tier A'],
    [zero, 'need $0 capital'],
    [auto, 'automation ≥ 7/10'],
    [all.filter((s) => !s.needsVerification).length, 'fully verified'],
    [
      all.filter((s) => (s.profitLikelihoodPercent ?? 0) >= 50).length,
      'profit odds ≥ 50%',
    ],
    [new Set(all.map((s) => s.category)).size, 'categories'],
  ];
  el('stats').innerHTML = items
    .map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`)
    .join('');
}

function shortlists(data) {
  const byId = new Map(data.strategies.map((s) => [s.id, s]));
  el('shortlists').innerHTML = (data.shortlists || [])
    .map(
      (sl) => `<div class="shortlist">
        <h3>${esc(sl.title)}</h3>
        <p>${esc(sl.blurb)}</p>
        <ol>${sl.ids
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map(
            (s) =>
              `<li><a href="#${esc(s.id)}" data-id="${esc(s.id)}">${esc(s.name)}</a> <span>${money(s.typicalMonthlyIncomeUsd.median)}/mo · ${s.priorityScore}</span></li>`
          )
          .join('')}</ol>
      </div>`
    )
    .join('');
  el('shortlists').addEventListener('click', (e) => {
    const a = e.target.closest('a[data-id]');
    if (a) {
      e.preventDefault();
      openDetail(a.dataset.id);
    }
  });
}

function openDetail(id) {
  const s = state.all.find((x) => x.id === id);
  if (!s) {
    return;
  }
  el('detailBody').innerHTML = detail(s);
  const dlg = el('detail');
  dlg.showModal();
  dlg.querySelector('article').scrollTop = 0;
  history.replaceState(null, '', `#${id}`);
}

async function init() {
  const res = await fetch('./strategies.json');
  const data = await res.json();
  state.all = data.strategies;
  el('count').textContent = String(data.count);

  const cats = new Map(state.all.map((s) => [s.category, s.categoryLabel]));
  for (const [value, label] of [...cats.entries()].sort((a, b) =>
    a[1].localeCompare(b[1])
  )) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    el('category').appendChild(opt);
  }

  stats(state.all);
  shortlists(data);
  for (const id of [
    'search',
    'category',
    'tier',
    'sort',
    'zeroCapital',
    'highAuto',
    'maxCash',
  ]) {
    el(id).addEventListener('input', apply);
  }
  el('list').addEventListener('click', (e) => {
    const c = e.target.closest('.card');
    if (c) {
      openDetail(c.dataset.id);
    }
  });
  el('list').addEventListener('keydown', (e) => {
    const c = e.target.closest('.card');
    if (c && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openDetail(c.dataset.id);
    }
  });
  el('detail').addEventListener('close', () =>
    history.replaceState(null, '', ' ')
  );
  apply();
  if (window.location.hash) {
    openDetail(window.location.hash.slice(1));
  }
}

init().catch((err) => {
  el('list').innerHTML =
    `<p class="empty">Failed to load catalog: ${esc(err.message)}</p>`;
});
