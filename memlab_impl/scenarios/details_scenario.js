'use strict';

const { leakFilter } = require('../filters/leak_filter');

/**
 * Step 1 — Baseline snapshot (SBP)
 */
function url() {
  return 'http://localhost:3000';
}

/**
 * Step 2 — Action snapshot (STP)
 */
async function action(page) {
  // console.log('Action: Waiting for initial character buttons...');

  // Wait for list page - increased timeout to 30s
  try {
    await page.waitForSelector('[data-testid="details-btn-1"]', { timeout: 30000 });
    // console.log('Action: Found character buttons.');
  } catch (err) {
    console.error('Action Error: Initial character buttons not found within 30s');
    throw err;
  }

  const characterButtons = [
    '[data-testid="details-btn-1"]',
    '[data-testid="details-btn-2"]',
  ];

  for (const btnSelector of characterButtons) {
    // console.log(`Action: Clicking ${btnSelector}...`);
    await page.waitForSelector(btnSelector, { visible: true, timeout: 10000 });

    await page.evaluate((sel) => {
      const btn = document.querySelector(sel);
      if (btn) btn.click();
      else throw new Error(`Button not found during execution: ${sel}`);
    }, btnSelector);

    // console.log(`Action: Waiting for details page (h1)...`);
    // Wait for details page
    await page.waitForSelector('h1', { timeout: 15000 });

    // console.log(`Action: Navigating back to list...`);
    // Go back to list
    await page.goBack();
    await page.waitForSelector('[data-testid="details-btn-1"]', { timeout: 15000 });
  }

  // console.log('Action: Final navigation to target state...');
  // Final navigation to target state
  await page.waitForSelector('[data-testid="details-btn-1"]', { visible: true, timeout: 10000 });

  await page.evaluate(() => {
    document.querySelector('[data-testid="details-btn-1"]').click();
  });

  await page.waitForSelector('h1', { timeout: 15000 });
  console.log('Action complete.');
}

/**
 * Step 3 — Final snapshot (SFP)
 * Return to baseline
 */
async function back(page) {
  // console.log('Back: Reverting to baseline...');
  await page.waitForSelector('h1', { timeout: 15000 });
  await page.goBack();
  await page.waitForSelector('[data-testid="details-btn-1"]', { timeout: 15000 });
  // console.log('Back complete.');
}

module.exports = { url, action, back, leakFilter };
