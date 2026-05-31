import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  date,
} from "drizzle-orm/pg-core";

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
// event_sources
// ---------------------------------------------------------------------------
export const eventSources = pgTable("event_sources", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id")
    .notNull()
    .references(() => cities.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  sourceType: text("source_type").notNull(), // "website" | "api" | "rss"
  active: boolean("active").notNull().default(true),
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
  isMajor: boolean("is_major").notNull().default(false),
  imageUrl: text("image_url"),
  eventUrl: text("event_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------
export type City = typeof cities.$inferSelect;
export type NewCity = typeof cities.$inferInsert;

export type Neighborhood = typeof neighborhoods.$inferSelect;
export type NewNeighborhood = typeof neighborhoods.$inferInsert;

export type EventSource = typeof eventSources.$inferSelect;
export type NewEventSource = typeof eventSources.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
