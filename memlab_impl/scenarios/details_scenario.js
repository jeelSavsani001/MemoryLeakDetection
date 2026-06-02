// memlab/scenarios/paginationScenario.js

module.exports = {
  url: () => "http://localhost:3000",

  action: async (page) => {
    console.log("👉 Waiting for button to render...");
    // 1. Ensure the app has hydrated and the button actually exists
    await page.waitForSelector('[data-testid="card-details-button-1"]', { timeout: 5000 });
    
    console.log("👉 Clicking button...");
    await page.click('[data-testid="card-details-button-1"]');

    console.log("👉 Waiting for details page to load...");
    // 2. CRITICAL: Wait for a specific element on the destination page to appear.
    // Replace '.character-details-view' with an actual class or ID from your details page.
    await page.waitForSelector('[data-testid="character-details"]', { timeout: 5000 });
  },

  back: async (page) => {
    console.log("👈 Triggering browser back...");
    // 3. This is perfectly fine for SPAs, as long as it doesn't trigger a hard reload.
    await page.goBack();

    console.log("👈 Waiting for list to return...");
    // 4. CRITICAL: Wait for the original UI to fully paint back onto the screen.
    await page.waitForSelector('[data-testid="card-details-button-1"]', { timeout: 5000 });
  }
};