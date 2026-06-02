function url() {
    return "http://localhost:3000";
}

// details1 -> back -> details2 -> back -> details3 -> back -> next -> prev

async function action(page) {
    const buttons = [
        '[data-testid="details-btn-1"]',
        '[data-testid="details-btn-2"]',
        '[data-testid="details-btn-3"]',
    ];

    for (const button of buttons) {
        await page.waitForSelector(button);
        await page.click(button);

        await page.goBack();
        await page.waitForSelector('[data-testid="details-btn-1"]');
    }

    await page.waitForSelector('[data-testid="next-button"]');
    await page.click('[data-testid="next-button"]');
}

async function back(page) {
    await page.waitForSelector('[data-testid="previous-button"]');
    await page.click('[data-testid="previous-button"]');
}

export default {
    url, action, back
}