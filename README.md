# MemoryLeakDetection
Next.js GraphQL App with Memory Leak Detection using React MemLab

## MemLab summary helper

A small script is included to run MemLab automatically, read the generated `results/data/cur/leaks.txt` report, and summarize the important leak signals together with heap snapshot metadata from `results/data/cur/snap-seq.json`.

Usage:

```bash
# Run MemLab with the default test scenario and summarize the results in one command
npm run memlab:run-summary
```

Optional arguments:

```bash
# Run MemLab with a custom scenario or work directory
npm run memlab:run-summary -- --scenario ./test.js --work-dir ./results

# Run MemLab with a custom Chromium binary path if required by your environment
npm run memlab:run-summary -- --scenario ./test.js --work-dir ./results --chromium-binary "/Users/jeel.savsani/.cache/puppeteer/chrome/mac-148.0.7778.178/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
```

If you already have a MemLab report file, you can still summarize it directly:

```bash
npm run memlab:summary -- ./path/to/memlab-output.txt
```

The wrapper script will:
- execute MemLab using the configured scenario
- search the work directory for report files
- summarize leak clusters and highlight important symbols like `#sym:cachedCharacterData`
