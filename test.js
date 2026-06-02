const scenario = {
  // 1. Start at the home/listing page
  url: () => 'https://memory-leak-detection-ruby.vercel.app/',

  // 2. Loop through multiple distinct characters to trigger separate cache entries
  action: async (page) => {
    // Wait for the list page to be ready by waiting for a button containing 'Details'
    await page.waitForFunction(() => 
      Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Details')),
      { timeout: 15000 }
    );

    const clickDetailsButton = async (index) => {
      await page.evaluate((idx) => {
        const btns = Array.from(document.querySelectorAll('button'))
          .filter(b => b.innerText.includes('Details'));
        if (btns[idx]) {
          btns[idx].click();
        } else {
          throw new Error(`Details button at index ${idx} not found`);
        }
      }, index);
    };

    const waitForList = async () => {
        await page.waitForFunction(() => 
          Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Details')),
          { timeout: 15000 }
        );
    };

    // Iterate through first few characters to trigger separate cache entries
    for (let i = 0; i < 3; i++) {
      await clickDetailsButton(i);
      
      // Wait for details page to load
      await page.waitForSelector('h1', { timeout: 15000 }); 
      
      // Navigate back to the list page
      await page.goBack();
      
      // Ensure we are back on the list page
      await waitForList();
    }
    
    // Perform final click to reach the "Target" state (a details page)
    await clickDetailsButton(0);
    await page.waitForSelector('h1', { timeout: 15000 });
  },

  // 3. Return to the baseline list page (Final state)
  back: async (page) => {
    await page.goBack();
    await page.waitForFunction(() => 
      Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Details')),
      { timeout: 15000 }
    );
  },
};

module.exports = scenario;
