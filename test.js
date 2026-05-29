const scenario = {
  // 1. Start at the home/listing page
  url: () => 'http://localhost:3000',

  // 2. Loop through multiple distinct characters to trigger separate cache entries
  action: async (page) => {
    const characterButtons = [
      '[data-testid="details-btn-1"]',
      '[data-testid="details-btn-2"]',
      '[data-testid="details-btn-3"]',
    ];

    for (const btnSelector of characterButtons) {
      await page.click(btnSelector);
      
      // Wait for the details page content to ensure the Apollo query executes and leaks data
      await page.waitForSelector('h1'); 
      
      // Navigate back to the list page before clicking the next character
      await page.goBack();
      await page.waitForSelector('[data-testid="details-btn-1"]');
    }
    
    // Perform one final click so MemLab can execute its standard cleanup assertion
    await page.click('[data-testid="details-btn-1"]');
    await page.waitForSelector('h1');
  },

  // 3. Return to the baseline list page
  back: async (page) => {
    await page.goBack();
    await page.waitForSelector('[data-testid="details-btn-1"]');
  },
};

module.exports = scenario;
