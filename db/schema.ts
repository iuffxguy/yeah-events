import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// cities
// ---------------------------------------------------------------------------
export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// neighborhoods
// ---------------------------------------------------------------------------
export const neighborhoods = pgTable("neighborhoods", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id")
    .notNull()
    .references(() => cities.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
});

// ---------------------------------------------------------------------------
// venues
// ---------------------------------------------------------------------------
export const venues = pgTable(
  "venues",
  {
    id: serial("id").primaryKey(),
    cityId: integer("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // normalized lowercase for matching
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

// ---------------------------------------------------------------------------
// event_sources
// ---------------------------------------------------------------------------
export const eventSources = pgTable(
  "event_sources",
  {
    id: serial("id").primaryKey(),
    cityId: integer("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    sourceType: text("source_type").notNull(), // "website" | "api" | "rss"
    active: boolean("active").notNull().default(true),
    lastChecked: timestamp("last_checked"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueUrl: uniqueIndex("event_sources_url_idx").on(table.url),
  })
);

// ---------------------------------------------------------------------------
// events
// ---------------------------------------------------------------------------
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id")
    .notNull()
    .references(() => cities.id, { onDelete: "cascade" }),
  sourceId: integer("source_id").references(() => eventSources.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  venueName: text("venue_name"),
  address: text("address"),
  neighborhoodId: integer("neighborhood_id").references(
    () => neighborhoods.id,
    { onDelete: "set null" }
  ),
  isFree: boolean("is_free").notNull().default(false),
  isKidFriendly: boolean("is_kid_friendly").notNull().default(false),
  themes: text("themes").array(),
  venueId: integer("venue_id").references(() => venues.id, { onDelete: "set null" }),
  isMajor: boolean("is_major").notNull().default(false),
  // "low" = 1 source, "medium" = 2-3 sources, "high" = 4+ sources
  confidence: text("confidence").notNull().default("low"),
  mentionCount: integer("mention_count").notNull().default(1),
  imageUrl: text("image_url"),
  eventUrl: text("event_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// event_mentions — tracks which sources have mentioned each event
// ---------------------------------------------------------------------------
export const eventMentions = pgTable(
  "event_mentions",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    sourceId: integer("source_id")
      .notNull()
      .references(() => eventSources.id, { onDelete: "cascade" }),
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
// Relations
// ---------------------------------------------------------------------------
export const eventsRelations = relations(events, ({ one }) => ({
  venue: one(venues, {
    fields: [events.venueId],
    references: [venues.id],
  }),
}));

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------
export type City = typeof cities.$inferSelect;
export type NewCity = typeof cities.$inferInsert;

export type Neighborhood = typeof neighborhoods.$inferSelect;
export type NewNeighborhood = typeof neighborhoods.$inferInsert;

export type EventSource = typeof eventSources.$inferSelect;
export type NewEventSource = typeof eventSources.$inferInsert;

export type Venue = typeof venues.$inferSelect;
export type NewVenue = typeof venues.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventWithVenue = Event & { venue: Venue | null };

export type EventMention = typeof eventMentions.$inferSelect;
export type NewEventMention = typeof eventMentions.$inferInsert;

export type Confidence = "low" | "medium" | "high";

export function mentionCountToConfidence(count: number): Confidence {
  if (count >= 4) return "high";
  if (count >= 2) return "medium";
  return "low";
}
