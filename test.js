const scenario = {
  // 1. Start at the home/listing page
  // url: () => 'http://localhost:3000',
  url: () => 'memory-leak-detection-git-main-jeelsavsani001s-projects.vercel.app',

  // Pre-test setup: Inject cookies to bypass Vercel Deployment Protection
  setup: async (page) => {
    const domain = 'memory-leak-detection-git-main-jeelsavsani001s-projects.vercel.app';
    
    // Replace 'YOUR_COOKIE_VALUE' with the value of '_vercel_jwt' from your browser
    await page.setCookie({
      name: '_vercel_jwt',
      value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJTSWFyRDdWcjdSTHBLUnBTbHA1YWFDZm4iLCJpYXQiOjE3ODAzNzUzODgsInVzZXJuYW1lIjoiamVlbHNhdnNhbmkwMDEiLCJvd25lcklkIjoidGVhbV9WOGZSaXBKcm9tcm9pZ2RuVjhuWjhtYTciLCJhdWQiOiJtZW1vcnktbGVhay1kZXRlY3Rpb24tZ2l0LW1haW4tamVlbHNhdnNhbmkwMDFzLXByb2plY3RzLnZlcmNlbC5hcHAiLCJzdWIiOiJzc28tcHJvdGVjdGlvbiJ9.C9DMfCJp5CdSSa-b-2DaGQZKzFyDnpL8O7f7WXLR6XE', 
      domain: domain,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    });

    console.log('Authentication cookie injected.');
  },

  // 2. Loop through multiple distinct characters to trigger separate cache entries
  action: async (page) => {
    const characterButtons = [
      '[data-testid="details-btn-1"]',
      '[data-testid="details-btn-2"]',
      '[data-testid="details-btn-3"]',
    ];

    // Wait for the list page to be ready
    await page.waitForSelector('[data-testid="details-btn-1"]', { timeout: 15000 });

    for (const btnSelector of characterButtons) {
    //   console.log(`Processing ${btnSelector}...`);
      
      await page.waitForSelector(btnSelector, { visible: true });
      
    //   console.log(`Clicking ${btnSelector} via evaluate...`);
      await page.evaluate((sel) => {
        const btn = document.querySelector(sel);
        if (btn) btn.click();
        else throw new Error(`Button not found: ${sel}`);
      }, btnSelector);
      
    //   console.log(`Waiting for details page h1...`);
      await page.waitForSelector('h1', { timeout: 15000 }); 
      
    //   console.log(`Going back to list page...`);
      await page.goBack();
      
      await page.waitForSelector('[data-testid="details-btn-1"]', { timeout: 15000 });
    }
    
    // console.log(`Performing final click for target state...`);
    await page.waitForSelector('[data-testid="details-btn-1"]', { visible: true });
    await page.evaluate(() => document.querySelector('[data-testid="details-btn-1"]').click());
    await page.waitForSelector('h1', { timeout: 15000 });
    
    // console.log(`Action phase complete.`);
  },

  // 3. Return to the baseline list page
  back: async (page) => {
    // console.log(`Back phase starting...`);
    await page.goBack();
    await page.waitForSelector('[data-testid="details-btn-1"]', { timeout: 15000 });
    // console.log(`Back phase complete.`);
  },
};

module.exports = scenario;
