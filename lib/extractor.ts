import * as cheerio from "cheerio";

// Elements that are never event content
const BOILERPLATE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
  "nav",
  "header",
  "footer",
  "aside",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  "[role='complementary']",
  "[aria-label='advertisement']",
  // Common class/id patterns for chrome
  ".nav", ".navbar", ".nav-bar",
  ".header", ".site-header", ".page-header",
  ".footer", ".site-footer", ".page-footer",
  ".sidebar", ".side-bar",
  ".cookie", ".cookie-banner", ".cookie-notice",
  ".ad", ".ads", ".advertisement", ".advert",
  ".popup", ".modal-overlay",
  ".breadcrumb", ".breadcrumbs",
  ".social-share", ".share-buttons",
  "#nav", "#navbar", "#header", "#footer", "#sidebar",
  "#cookie", "#cookie-banner",
].join(", ");

// Ordered list of selectors to try for the "main content" region.
// We use the first one that exists and contains meaningful text.
const CONTENT_CANDIDATES = [
  "main",
  "[role='main']",
  "#main",
  "#content",
  "#main-content",
  ".main-content",
  ".events",
  ".event-list",
  ".event-listing",
  ".event-listings",
  "#events",
  "#event-list",
  "article",
  ".content",
  "#page-content",
  ".page-content",
];

// Minimum chars for a content candidate to be considered non-trivial
const MIN_CONTENT_LENGTH = 200;

export type ExtractResult = {
  /** Cleaned text ready to send to Claude */
  content: string;
  /** JSON-LD objects found on the page (often contain full event data) */
  jsonLd: unknown[];
  /** Approximate character count before extraction (for logging) */
  rawLength: number;
};

/**
 * Use Cheerio to strip boilerplate from raw HTML and extract the
 * event-relevant portion of the page. Also pulls any JSON-LD structured
 * data, which event sites frequently embed and which Claude can parse
 * far more cheaply than free-form text.
 */
export function extractEventContent(html: string): ExtractResult {
  const rawLength = html.length;
  const $ = cheerio.load(html);

  // --- 1. Pull JSON-LD before we destroy the DOM ---
  const jsonLd: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      // Flatten @graph arrays
      if (parsed?.["@graph"]) {
        jsonLd.push(...parsed["@graph"]);
      } else {
        jsonLd.push(parsed);
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  // --- 2. Remove boilerplate ---
  $(BOILERPLATE_SELECTORS).remove();

  // --- 3. Find the best content region ---
  // Use a CSS selector string so $root stays typed as Cheerio<AnyNode>
  let contentSelector = "body";

  for (const selector of CONTENT_CANDIDATES) {
    const $candidate = $(selector).first();
    if ($candidate.length && $candidate.text().trim().length > MIN_CONTENT_LENGTH) {
      contentSelector = selector;
      break;
    }
  }

  const $root = $(contentSelector);

  // --- 4. Extract and clean text ---
  const rawText = $root
    .find("*")
    .addBack()
    .map((_, el) => {
      // Only leaf-ish text nodes — skip elements whose children produce text
      const $el = $(el);
      const ownText = $el.clone().children().remove().end().text().trim();
      return ownText;
    })
    .get()
    .filter(Boolean)
    .join("\n");

  // Collapse runs of blank lines to a single newline
  const content = rawText
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    // Hard cap: ~6 000 chars is plenty for Claude when the content is clean
    .slice(0, 6000);

  return { content, jsonLd, rawLength };
}

/**
 * Build the text payload to send to Claude.
 * Prefers JSON-LD (structured, cheap) and appends cleaned prose as fallback.
 */
export function buildClaudePayload(extracted: ExtractResult): string {
  const parts: string[] = [];

  const eventLd = extracted.jsonLd.filter(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      ["Event", "SportsEvent", "MusicEvent", "FoodEvent", "TheaterEvent"].includes(
        (item as Record<string, unknown>)["@type"] as string
      )
  );

  if (eventLd.length > 0) {
    parts.push("STRUCTURED DATA (JSON-LD):");
    parts.push(JSON.stringify(eventLd).slice(0, 8000));
  }

  if (extracted.content) {
    parts.push("PAGE TEXT:");
    parts.push(extracted.content);
  }

  return parts.join("\n\n");
}
