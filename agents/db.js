/**
 * Drizzle ORM setup for the agents container.
 * Mirrors the schema from ../db/schema.ts — keep in sync if schema changes.
 * Uses @neondatabase/serverless with WebSocket polyfill for Node.js.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// ---------------------------------------------------------------------------
// Schema (mirrors ../db/schema.ts)
// ---------------------------------------------------------------------------

export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const neighborhoods = pgTable("neighborhoods", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
});

export const venues = pgTable(
  "venues",
  {
    id: serial("id").primaryKey(),
    cityId: integer("city_id").notNull(),
    name: text("name").notNull(),
    displayName: text("display_name").notNull(),
    address: text("address"),
    description: text("description"),
    website: text("website"),
    enriched: boolean("enriched").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueNameCity: uniqueIndex("venues_name_city_idx").on(table.name, table.cityId),
  })
);

export const eventSources = pgTable(
  "event_sources",
  {
    id: serial("id").primaryKey(),
    cityId: integer("city_id").notNull(),
    url: text("url").notNull(),
    sourceType: text("source_type").notNull(),
    active: boolean("active").notNull().default(true),
    lastChecked: timestamp("last_checked"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueUrl: uniqueIndex("event_sources_url_idx").on(table.url),
  })
);

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull(),
  sourceId: integer("source_id"),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  venueName: text("venue_name"),
  address: text("address"),
  neighborhoodId: integer("neighborhood_id"),
  isFree: boolean("is_free").notNull().default(false),
  isKidFriendly: boolean("is_kid_friendly").notNull().default(false),
  themes: text("themes").array(),
  venueId: integer("venue_id"),
  isMajor: boolean("is_major").notNull().default(false),
  confidence: text("confidence").notNull().default("low"),
  mentionCount: integer("mention_count").notNull().default(1),
  imageUrl: text("image_url"),
  eventUrl: text("event_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const eventMentions = pgTable(
  "event_mentions",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull(),
    sourceId: integer("source_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueEventSource: uniqueIndex("event_mentions_event_source_idx").on(
      table.eventId,
      table.sourceId
    ),
  })
);

// ---------------------------------------------------------------------------
// Database connection
// ---------------------------------------------------------------------------

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, {
  schema: { cities, neighborhoods, eventSources, venues, events, eventMentions },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function mentionCountToConfidence(count) {
  if (count >= 4) return "high";
  if (count >= 2) return "medium";
  return "low";
}

export function normalizeTitle(title) {
  const base = title.split(/\s*:\s+|\s+--\s+/)[0];
  return base
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
