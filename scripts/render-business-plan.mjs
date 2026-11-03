/**
 * Markdown renderer for the per-strategy `businessPlan` block and the
 * incorporation-cost table. Kept separate so build-catalog.mjs stays small.
 */

const money = (n) =>
  n === undefined || n === null
    ? 'n/a'
    : `$${Number(n).toLocaleString('en-US')}`;

const range = (r) =>
  r ? `${money(r.low)} / ${money(r.median)} / ${money(r.high)}` : 'n/a';

/**
 * Validate a businessPlan object. Returns problems (empty = ok).
 * @param {object} bp
 * @returns {string[]}
 */
export function validateBusinessPlan(bp) {
  const p = [];
  if (!bp || typeof bp !== 'object') {
    return ['businessPlan missing'];
  }
  const sr = bp.startupResources || {};
  const ue = bp.unitEconomics || {};
  const be = bp.breakEven || {};
  const mc = bp.marketConditions || {};
  const num = (v, name) => {
    if (typeof v !== 'number' || Number.isNaN(v)) {
      p.push(`${name} must be a number`);
    }
  };
  num(sr.timeHoursToLaunch, 'startupResources.timeHoursToLaunch');
  num(sr.cashUsd, 'startupResources.cashUsd');
  num(sr.recurringMonthlyUsd, 'startupResources.recurringMonthlyUsd');
  if (!ue.unit) {
    p.push('unitEconomics.unit missing');
  }
  if (!ue.typicalPriceUsd) {
    p.push('unitEconomics.typicalPriceUsd missing');
  }
  num(ue.grossMarginPercent, 'unitEconomics.grossMarginPercent');
  num(be.typicalMonthsToBreakEven, 'breakEven.typicalMonthsToBreakEven');
  num(mc.profitLikelihoodPercent, 'marketConditions.profitLikelihoodPercent');
  if (
    typeof mc.profitLikelihoodPercent === 'number' &&
    (mc.profitLikelihoodPercent < 0 || mc.profitLikelihoodPercent > 100)
  ) {
    p.push('marketConditions.profitLikelihoodPercent out of range');
  }
  if (!['growing', 'stable', 'declining'].includes(mc.demandTrend)) {
    p.push(`marketConditions.demandTrend invalid: ${mc.demandTrend}`);
  }
  if (!['low', 'medium', 'high', 'saturated'].includes(mc.competition)) {
    p.push(`marketConditions.competition invalid: ${mc.competition}`);
  }
  if (!Array.isArray(bp.profitPath) || bp.profitPath.length < 2) {
    p.push('profitPath needs at least 2 steps');
  }
  return p;
}

/**
 * Render the "Resources & business plan" markdown section.
 * @param {object} bp
 * @returns {string}
 */
export function renderBusinessPlan(bp) {
  if (!bp) {
    return [
      '## Resources & business plan',
      '',
      '_Not yet compiled for this entry._',
      '',
    ].join('\n');
  }
  const sr = bp.startupResources || {};
  const ue = bp.unitEconomics || {};
  const be = bp.breakEven || {};
  const mc = bp.marketConditions || {};
  const lines = [];
  lines.push('## Resources & business plan');
  lines.push('');
  lines.push('### What you need to start');
  lines.push('');
  lines.push('| Resource | Amount |');
  lines.push('| --- | --- |');
  lines.push(`| Time to launch | ${sr.timeHoursToLaunch ?? 'n/a'} hours |`);
  lines.push(`| One-time cash | ${money(sr.cashUsd)} |`);
  lines.push(
    `| Recurring fixed cost | ${money(sr.recurringMonthlyUsd)} / month |`
  );
  lines.push(`| Tools | ${(sr.tools || []).join('; ') || 'none'} |`);
  lines.push(`| Skills | ${(sr.skills || []).join('; ') || 'none'} |`);
  lines.push(`| Equipment | ${(sr.equipment || []).join('; ') || 'none'} |`);
  lines.push(`| Accounts | ${(sr.accounts || []).join('; ') || 'none'} |`);
  lines.push('');
  lines.push('### How the money is made (unit economics)');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('| --- | --- |');
  lines.push(`| Unit | ${ue.unit ?? 'n/a'} |`);
  lines.push(
    `| Typical price per unit (low / median / high) | ${range(ue.typicalPriceUsd)} |`
  );
  lines.push(`| Direct cost per unit | ${money(ue.costPerUnitUsd)} |`);
  lines.push(`| Platform fee | ${ue.platformFeePercent ?? 0}% |`);
  lines.push(
    `| Gross margin (median case) | ${ue.grossMarginPercent ?? 'n/a'}% |`
  );
  lines.push(
    `| Human hours per unit after automation | ${ue.hoursPerUnit ?? 'n/a'} |`
  );
  if (ue.notes) {
    lines.push('');
    lines.push(ue.notes);
  }
  lines.push('');
  lines.push('### Break-even');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('| --- | --- |');
  lines.push(`| Monthly fixed cost | ${money(be.monthlyFixedCostUsd)} |`);
  lines.push(
    `| Units per month to break even | ${be.unitsPerMonthToBreakEven ?? 0} |`
  );
  lines.push(
    `| Typical months to break even | ${be.typicalMonthsToBreakEven ?? 'n/a'} |`
  );
  lines.push(
    `| Months to recover startup cash | ${be.monthsToRecoverStartup ?? 0} |`
  );
  if (be.notes) {
    lines.push('');
    lines.push(be.notes);
  }
  lines.push('');
  lines.push('### Market conditions (Nov 2026)');
  lines.push('');
  lines.push('| Factor | Assessment |');
  lines.push('| --- | --- |');
  lines.push(`| Demand trend | ${mc.demandTrend ?? 'n/a'} |`);
  lines.push(`| Competition | ${mc.competition ?? 'n/a'} |`);
  lines.push(`| Effect of AI | ${mc.aiImpact ?? 'n/a'} |`);
  lines.push(`| Price pressure | ${mc.pricePressure ?? 'n/a'} |`);
  lines.push(
    `| **Chance of real net profit within 12 months** (≥ $100/month where the plan can pay that much) | **${mc.profitLikelihoodPercent ?? 'n/a'}%** |`
  );
  lines.push(
    `| Typical net profit at month 12 (low / median / high) | ${range(mc.typicalNetProfitMonth12Usd)} |`
  );
  if (mc.notes) {
    lines.push('');
    lines.push(mc.notes);
  }
  lines.push('');
  lines.push('### Pricing strategy');
  lines.push('');
  lines.push(bp.pricingStrategy || 'n/a');
  lines.push('');
  lines.push('### Path to profit');
  lines.push('');
  lines.push(
    (bp.profitPath || []).map((step, i) => `${i + 1}. ${step}`).join('\n') ||
      'n/a'
  );
  lines.push('');
  if (Array.isArray(bp.sources) && bp.sources.length) {
    lines.push('_Business-plan sources:_');
    lines.push('');
    lines.push(bp.sources.map((u) => `- <${u}>`).join('\n'));
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Render the incorporation-cost table for all reference countries.
 * @param {object[]} countries - merged data/incorporation/*.json entries
 * @returns {string}
 */
export function renderIncorporation(countries) {
  const sorted = [...countries].sort((a, b) =>
    a.country.localeCompare(b.country)
  );
  const lines = [];
  lines.push('# Cost of registering a business in the reference countries');
  lines.push('');
  lines.push(
    'What it costs and takes for a resident to legally earn online income in each of the 50 reference countries, as a sole proprietor and through a limited company. All figures in USD, compiled 2026-11-03. Entries marked _estimated_ could not be confirmed on an official page; check the sources before acting. This is research, not legal or tax advice.'
  );
  lines.push('');
  lines.push(
    '> Generated by `npm run build:catalog` from `data/incorporation/*.json`. Edit the JSON, not this file. See also [remote incorporation options](./remote-incorporation-options.md) for registering a company outside your country of residence.'
  );
  lines.push('');
  lines.push('## Summary table');
  lines.push('');
  lines.push(
    '| Country | Sole proprietor: when required | Reg. cost | Annual | Company type | Gov. fee | All-in | Annual compliance | Min. capital | Corp. tax | VAT | VAT threshold | Confidence |'
  );
  lines.push(
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  );
  for (const c of sorted) {
    const sp = c.soleProprietor || {};
    const co = c.company || {};
    const t = c.tax || {};
    const thr =
      t.vatRegistrationThresholdUsd === null ||
      t.vatRegistrationThresholdUsd === undefined
        ? 'none'
        : t.vatRegistrationThresholdUsd === 0
          ? 'from first sale'
          : money(t.vatRegistrationThresholdUsd);
    lines.push(
      `| ${c.country} | ${sp.registrationRequired ?? 'n/a'} | ${money(sp.registrationCostUsd)} | ${money(sp.annualCostUsd)} | ${co.type ?? 'n/a'} | ${money(co.formationCostUsd)} | ${money(co.typicalAllInFormationCostUsd)} | ${money(co.annualComplianceCostUsd)} | ${money(co.minimumCapitalUsd)} | ${t.corporateRatePercent ?? 'n/a'}% | ${t.vatRatePercent ?? 'n/a'}% | ${thr} | ${c.confidence ?? 'estimated'} |`
    );
  }
  lines.push('');
  lines.push('## Country details');
  lines.push('');
  for (const c of sorted) {
    const sp = c.soleProprietor || {};
    const co = c.company || {};
    const t = c.tax || {};
    const fx = c.foreignCurrency || {};
    lines.push(`### ${c.iso2} ${c.country}`);
    lines.push('');
    lines.push(
      `**Sole proprietor.** Registration: ${sp.registrationRequired ?? 'n/a'}${sp.thresholdNote ? ` (${sp.thresholdNote})` : ''}. Cost ${money(sp.registrationCostUsd)}, annual ${money(sp.annualCostUsd)}, about ${sp.timeDays ?? 'n/a'} days, online: ${sp.onlinePossible ? 'yes' : 'no'}. ${sp.notes || ''}${sp.registerUrl ? ` Register: <${sp.registerUrl}>` : ''}`
    );
    lines.push('');
    lines.push(
      `**Company.** ${co.type ?? 'n/a'}: government fee ${money(co.formationCostUsd)}, typical all-in ${money(co.typicalAllInFormationCostUsd)}, minimum capital ${money(co.minimumCapitalUsd)}, annual compliance about ${money(co.annualComplianceCostUsd)}, about ${co.timeDays ?? 'n/a'} days, online: ${co.onlinePossible ? 'yes' : 'no'}, 100% foreign ownership: ${co.foreignerCanOwn100Percent ? 'yes' : 'no'}, local director required: ${co.localDirectorRequired ? 'yes' : 'no'}. ${co.notes || ''}${co.registerUrl ? ` Register: <${co.registerUrl}>` : ''}`
    );
    lines.push('');
    lines.push(
      `**Tax.** Corporate ${t.corporateRatePercent ?? 'n/a'}%, personal top rate ${t.personalTopRatePercent ?? 'n/a'}%, VAT ${t.vatRatePercent ?? 'n/a'}%${t.vatRegistrationThresholdUsd === null || t.vatRegistrationThresholdUsd === undefined ? ' (no registration threshold)' : ` above ${money(t.vatRegistrationThresholdUsd)}`}. Small-business regime: ${t.smallBusinessRegime || 'none noted'}. ${t.digitalServicesNote || ''}`
    );
    lines.push('');
    lines.push(
      `**Foreign currency.** Capital controls: ${fx.capitalControls ?? 'n/a'}. ${fx.notes || ''}`
    );
    lines.push('');
    if (Array.isArray(c.sources) && c.sources.length) {
      lines.push(`Sources: ${c.sources.map((u) => `<${u}>`).join(', ')}`);
      lines.push('');
    }
    lines.push(
      `_Confidence: ${c.confidence ?? 'estimated'}; last checked ${c.lastChecked ?? 'n/a'}._`
    );
    lines.push('');
  }
  return lines.join('\n');
}
