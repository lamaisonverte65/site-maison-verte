import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getFiscalRule,
  classifyFiscalOperation,
  buildFiscalSummary,
} from '../netlify/functions/_lib/accounting-fiscal-rules.js';

test('2025 unclassified LMNP micro-BIC uses official declarant-2 box 5OH and 30 percent abatement', () => {
  const rule = getFiscalRule(2025, 'tourist_furnished_unclassified', 2);
  assert.equal(rule.form, '2042-C-PRO');
  assert.equal(rule.box, '5OH');
  assert.equal(rule.abatementRate, 0.30);
  assert.equal(rule.ruleStatus, 'confirmed');
});

test('2025 classified LMNP micro-BIC uses official declarant-2 box 5OG and 50 percent abatement', () => {
  const rule = getFiscalRule(2025, 'tourist_furnished_classified', 2);
  assert.equal(rule.form, '2042-C-PRO');
  assert.equal(rule.box, '5OG');
  assert.equal(rule.abatementRate, 0.50);
  assert.equal(rule.ruleStatus, 'confirmed');
});

test('declarant-specific boxes are versioned rather than inferred from history', () => {
  assert.equal(getFiscalRule(2025, 'tourist_furnished_unclassified', 1).box, '5NH');
  assert.equal(getFiscalRule(2025, 'tourist_furnished_classified', 1).box, '5NG');
});

test('2026 income keeps known tax regime but leaves unpublished 2027 box pending', () => {
  const classified = getFiscalRule(2026, 'tourist_furnished_classified', 2);
  const unclassified = getFiscalRule(2026, 'tourist_furnished_unclassified', 2);
  assert.equal(classified.declarationYear, 2027);
  assert.equal(classified.box, null);
  assert.equal(classified.abatementRate, 0.50);
  assert.equal(classified.ruleStatus, 'form_pending');
  assert.equal(unclassified.box, null);
  assert.equal(unclassified.abatementRate, 0.30);
  assert.equal(unclassified.ruleStatus, 'form_pending');
});

test('classification transition ambiguity never invents a fiscal category', () => {
  const result = classifyFiscalOperation({ grossKnownCents: 50000 }, { classificationStatus: 'ambiguous' });
  assert.equal(result.fiscalCategory, null);
  assert.equal(result.fiscalStatus, 'a_verifier');
  assert.match(result.reason, /classification_transition/);
});

test('classified and unclassified operations are categorized only when context establishes classification', () => {
  assert.equal(classifyFiscalOperation({}, { classification: '3_star' }).fiscalCategory, 'tourist_furnished_classified');
  assert.equal(classifyFiscalOperation({}, { classification: 'unclassified' }).fiscalCategory, 'tourist_furnished_unclassified');
  assert.equal(classifyFiscalOperation({}, {}).fiscalStatus, 'a_verifier');
});

test('fiscal summary uses gross demonstrated receipts and never subtracts commission or payment fees', () => {
  const rows = [
    {
      status: 'coherent',
      fiscalStatus: 'coherent',
      fiscalCategory: 'tourist_furnished_unclassified',
      fiscalGrossAmountCents: 100000,
      commissionCents: 15000,
      paymentFeeCents: 3000,
    },
  ];
  const summary = buildFiscalSummary(rows, 2025, 2);
  assert.equal(summary.categories[0].grossAmountCents, 100000);
  assert.equal(summary.totalGrossAmountCents, 100000);
});

test('ambiguous and missing rows are excluded from final fiscal total but retained as pending amount', () => {
  const rows = [
    { status: 'coherent', fiscalStatus: 'coherent', fiscalCategory: 'tourist_furnished_unclassified', fiscalGrossAmountCents: 100000 },
    { status: 'a_verifier', fiscalStatus: 'a_verifier', fiscalCategory: null, grossKnownCents: 40000, fiscalGrossAmountCents: null },
    { status: 'manquant', fiscalStatus: 'manquant', fiscalCategory: null, grossKnownCents: 20000, fiscalGrossAmountCents: null },
  ];
  const summary = buildFiscalSummary(rows, 2025, 2);
  assert.equal(summary.totalGrossAmountCents, 100000);
  assert.equal(summary.pendingKnownGrossAmountCents, 60000);
  assert.equal(summary.pendingRows, 2);
});
