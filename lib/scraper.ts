import { chromium, type Page } from "playwright";
import { extractEventContent, type ExtractResult } from "./extractor";

export type ScrapeResult = {
  url: string;
  /** Raw HTML — keep for debugging, not sent to Claude */
  html: string;
  /** Cheerio-extracted, boilerplate-stripped content + JSON-LD */
  extracted: ExtractResult;
};

/**
 * Launch a headless Chromium instance, navigate to `url`, fetch the HTML,
 * then run Cheerio extraction to strip nav/footer/ads before returning.
 *
 * Note: Vercel Serverless Functions have a 50 MB limit. For production
 * scraping you should use a dedicated scraping service (e.g. Browserless,
 * ScrapingBee) or run Playwright in a separate Vercel Edge Function / AWS
 * Lambda with a custom layer. This stub works in local dev and on machines
 * with Playwright installed.
 */
export async function scrapePage(url: string): Promise<ScrapeResult> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (compatible; YeahEventsBot/1.0; +https://yeah-events.com/bot)",
  });

  let html = "";

  try {
    const page: Page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(1500); // allow JS to settle
    html = await page.content();
  } finally {
    await browser.close();
  }

  const extracted = extractEventContent(html);
  console.log(
    `[scraper] ${url} — raw ${Math.round(extracted.rawLength / 1024)}KB → ` +
    `extracted ${extracted.content.length} chars, ${extracted.jsonLd.length} JSON-LD items`
  );

  return { url, html, extracted };
}

/**
 * Scrape multiple URLs sequentially (to avoid hammering servers).
 */
export async function scrapePages(urls: string[]): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];
  for (const url of urls) {
    try {
      results.push(await scrapePage(url));
    } catch (err) {
      console.error(`[scraper] Failed to scrape ${url}:`, err);
    }
  }
  return results;
}
