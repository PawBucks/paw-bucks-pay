import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const compId = process.argv[2] || "horizontal";
const outFile = process.argv[3] || `/mnt/documents/pawbucks-${compId}.mp4`;

console.log(`Bundling for ${compId}...`);
const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (config) => config,
});

console.log("Opening browser...");
const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: {
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  },
  chromeMode: "chrome-for-testing",
});

console.log("Selecting composition...");
const composition = await selectComposition({
  serveUrl: bundled,
  id: compId,
  puppeteerInstance: browser,
});

console.log(`Rendering to ${outFile} (${composition.width}x${composition.height}, ${composition.durationInFrames} frames)...`);
await renderMedia({
  composition,
  serveUrl: bundled,
  codec: "h264",
  outputLocation: outFile,
  puppeteerInstance: browser,
  muted: true,
  concurrency: 2,
  onProgress: ({ progress }) => {
    if (Math.floor(progress * 100) % 10 === 0) {
      process.stdout.write(`  ${(progress * 100).toFixed(0)}%\n`);
    }
  },
});

await browser.close({ silent: false });
console.log("Done:", outFile);