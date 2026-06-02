function url() {
    return "http://localhost:3000/";
}

async function action(page) {
    await page.click('[data-testid="next-button"]');
}

async function back(page) {
    await page.click('[data-testid="previous-button"]');
}

module.exports = { url, action, back };