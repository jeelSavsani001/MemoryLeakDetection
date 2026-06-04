'use strict';

const { leakFilter } = require('../filters/dev_filter');

/**
 * Step 1 — Baseline snapshot (S1)
 */
function url() {
  return 'http://localhost:3000';
}

/**
 * Step 2 — Target snapshot (S2)
 * Perform interactions and manually return to the baseline state.
 */
async function action(page) {
  try {
    await page.waitForSelector('[data-testid="details-btn-1"]', { timeout: 30000 });
  } catch (err) {
    console.error('Action Error: Initial character buttons not found within 30s');
    throw err;
  }

  const characterButtons = [
    '[data-testid="details-btn-1"]',
    '[data-testid="details-btn-2"]',
  ];

  for (const btnSelector of characterButtons) {
    await page.waitForSelector(btnSelector, { visible: true, timeout: 10000 });

    await page.evaluate((sel) => {
      const btn = document.querySelector(sel);
      if (btn) btn.click();
      else throw new Error(`Button not found during execution: ${sel}`);
    }, btnSelector);

    await page.waitForSelector('h1', { timeout: 15000 });

    // Return to list page
    await page.goBack();
    await page.waitForSelector('[data-testid="details-btn-1"]', { timeout: 15000 });
  }

  // Final check to ensure we are back at baseline before S2 is taken
  await page.waitForSelector('[data-testid="details-btn-1"]', { visible: true, timeout: 10000 });
  console.log('Action complete (manually returned to baseline).');
}

/**
 * Step 3 — Final snapshot (S3)
 * We provide a no-op function so memlab doesn't trigger a page reload
 * by trying to "revert" automatically.
 */
async function back(page) {
  // Do nothing. We are already at the baseline state.
  // This prevents memlab from using its default 'revert' which causes reloads.
  console.log('Back phase: No-op (already at baseline).');
}

module.exports = { url, action, back, leakFilter };
