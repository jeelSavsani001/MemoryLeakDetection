
const memlab = require("@memlab/api");
const path = require("path");

async function run() {
  try {
    console.log("Starting MemLab run...");
    await memlab.run({
      scenario: require("./test"),
      chromiumBinary: "/Users/jeel.savsani/.cache/puppeteer/chrome/mac-148.0.7778.178/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      workDir: path.join(__dirname, "results"),
      // Set a larger timeout for the whole run if needed
    });

    console.log("MemLab run complete.");
  } catch (e) {
    console.error("MemLab run failed:");
    console.error(e);
    process.exit(1);
  }
}

run();

