// test.js
const { leakFilter, retainerReferenceFilter } = require('./memlab_impl/filters/leak_filter');

function url() {
  return "http://localhost:3000/";
}

// interaction to trigger memory leak
async function action(page) {
  // Wait for the cards to be rendered
  await page.waitForSelector('[data-testid^="details-btn-"]', { timeout: 5000 });
  
  // Optional: Add a small delay to simulate user behavior or ensure everything is settled
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));

  // Find the first "Details" button and click it
  const detailsButton = await page.$('[data-testid^="details-btn-"]');
  if (detailsButton) {
    await detailsButton.click();
  }

  // Wait for the details page to load
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));
}

// interaction to go back to the initial state
async function back(page) {
  await page.goBack();
  
  // Wait for the index page to reload and be stable
  await page.waitForSelector('[data-testid^="details-btn-"]', { timeout: 5000 });
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
}

module.exports = { url, action, back, leakFilter, retainerReferenceFilter };
