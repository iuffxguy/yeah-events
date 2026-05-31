import { extractEventContent, type ExtractResult } from "./extractor";

export type ScrapeResult = {
  url: string;
  /** Raw HTML — keep for debugging, not sent to Claude */
  html: string;
  /** Cheerio-extracted, boilerplate-stripped content + JSON-LD */
  extracted: ExtractResult;
};

/**
 * Fetch a URL with a plain HTTP request and run Cheerio extraction.
 * Works on Vercel serverless functions — no browser required.
 * For JS-heavy SPAs that need a real browser, swap this out for
 * Browserless or a dedicated scraping service.
 */
export async function scrapePage(url: string): Promise<ScrapeResult> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; YeahEventsBot/1.0; +https://yeah-events.com/bot)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }

  const html = await response.text();
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
