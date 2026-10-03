// Genera PDFs de prueba con el navegador y los guarda en pdf-test-output/.
// Requiere `npm run dev` en marcha y playwright-core (npm i --no-save playwright-core).
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE_URL = process.env.PDF_HARNESS_URL || "http://localhost:5173/scripts/pdf-harness.html";
const EDGE = process.env.BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUT = "pdf-test-output";

const CASES = [
  { name: "0-fotos", photos: 0, signed: false },
  { name: "1-foto-firma", photos: 1, signed: true },
  { name: "6-fotos", photos: 6, signed: false },
  { name: "7-fotos-firma", photos: 7, signed: true },
  { name: "15-fotos", photos: 15, signed: false },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage();
page.on("pageerror", (error) => console.error("Error en la página:", error.message));
await page.goto(BASE_URL);
await page.waitForFunction(() => window.harnessReady === true);

for (const testCase of CASES) {
  const base64 = await page.evaluate(({ photos, signed }) => window.makePdf(photos, signed), testCase);
  writeFileSync(`${OUT}/${testCase.name}.pdf`, Buffer.from(base64, "base64"));
  console.log("OK", testCase.name);
}

await browser.close();
