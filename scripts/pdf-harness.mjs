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
  { name: "desc-larga-6-fotos", photos: 6, signed: true, longText: true },
  { name: "pesadas-15-fotos", photos: 15, signed: true, heavy: true },
  { name: "caracteres-especiales", photos: 1, signed: false, special: true },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage();
page.on("pageerror", (error) => console.error("Error en la página:", error.message));
await page.goto(BASE_URL);
await page.waitForFunction(() => window.harnessReady === true);

for (const testCase of CASES) {
  const { photos, signed, longText, heavy, special } = testCase;
  const { base64, ms } = await page.evaluate(
    ({ photos, signed, opts }) => window.makePdf(photos, signed, opts),
    { photos, signed, opts: { longText, heavy, special } }
  );
  const buffer = Buffer.from(base64, "base64");
  writeFileSync(`${OUT}/${testCase.name}.pdf`, buffer);
  console.log("OK", testCase.name, `${(buffer.length / 1024 / 1024).toFixed(2)} MB`, `${ms} ms`);
}

await browser.close();
