module.exports = {
    url: () => "http://localhost:3000/",

    action: async(page) => {
        console.log("👉 Waiting for button to render...");

        await page.waitForSelector('[data-testid="details-btn-1"]', { timeout: 3000 });

        console.log("👉 Clicking button...")
        await page.click('[data-testid="details-btn-1"]');

        console.log("👉 Waiting for details page to load...");
        await page.waitForSelector('[data-testid="character-details"]', { timeout: 3000 });

        console.log("👉 Waiting for mount leaky button...");
        await page.waitForSelector('[data-testid="mount-leaky-btn"]', { timeout: 3000 });

        console.log("👉 Clicking mount leaky button...")
        await page.click('[data-testid="mount-leaky-btn"]');

        console.log("👉 Waiting for leaky child to mount...");
        await page.waitForSelector('[data-testid="leaky-child"]', { timeout: 3000 });

        console.log("👉 Unmounting leaky child...");
        await page.click('[data-testid="unmount-both-btn"]');

        console.log("👉 Waiting for leaky child to unmount...");
        await page.waitForSelector('[data-testid="leaky-child"]', { timeout: 3000, hidden: true });

        // 🛡️ THE FIX FOR LEAKY CHILD: Give React time to flush its deletions array
        console.log("👉 Yielding to let React Scheduler finish cleanup...");
        await new Promise(resolve => setTimeout(resolve, 4000));
    },
    back: async(page) => {
        console.log("👈 Triggering browser back...");
        await page.goBack();
        console.log("👈 Waiting for list to return...");
        await page.waitForSelector('[data-testid="details-btn-1"]', { timeout: 3000 });

        // 🛡️ THE FIX FOR LEAKY CHILD: Give React time to flush its deletions array
        console.log("👉 Yielding to let React Scheduler finish cleanup...");
        await new Promise(resolve => setTimeout(resolve, 4000));
    }
};