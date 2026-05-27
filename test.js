const scenario = {
    url: () => 'http://localhost:3000',
    action: async(page) => {
        await page.goto("http://localhost:3000/?page=41");
    },
    back: async(page) => {
        await page.goto("http://localhost:3000");
    },
}
module.exports = scenario;