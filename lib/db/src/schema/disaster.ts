import { createInsertSchema } from "drizzle-zod";
import {
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const incidentsTable = pgTable("incidents", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  incidentType: text("incident_type").notNull(),
  status: text("status").notNull().default("Active"),
  severity: text("severity").notNull().default("Moderate"),
  location: text("location").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  summary: text("summary").notNull().default(""),
  affectedPopulation: integer("affected_population").notNull().default(0),
  evacuatedPopulation: integer("evacuated_population").notNull().default(0),
  deaths: integer("deaths").notNull().default(0),
  injuries: integer("injuries").notNull().default(0),
  missing: integer("missing").notNull().default(0),
  partiallyDamaged: integer("partially_damaged").notNull().default(0),
  totallyDamaged: integer("totally_damaged").notNull().default(0),
});

export const evacuationCentersTable = pgTable("evacuation_centers", {
  id: serial("id").primaryKey(),
  incidentId: integer("incident_id")
    .notNull()
    .references(() => incidentsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  barangay: text("barangay").notNull(),
  address: text("address").notNull(),
  capacity: integer("capacity").notNull().default(0),
  currentPopulation: integer("current_population").notNull().default(0),
  families: integer("families").notNull().default(0),
  men: integer("men").notNull().default(0),
  women: integer("women").notNull().default(0),
  children: integer("children").notNull().default(0),
  seniors: integer("seniors").notNull().default(0),
  pwd: integer("pwd").notNull().default(0),
  status: text("status").notNull().default("Open"),
  contactPerson: text("contact_person").notNull().default(""),
  contactNumber: text("contact_number").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const structureDamagesTable = pgTable("structure_damages", {
  id: serial("id").primaryKey(),
  incidentId: integer("incident_id")
    .notNull()
    .references(() => incidentsTable.id, { onDelete: "cascade" }),
  structureType: text("structure_type").notNull(),
  location: text("location").notNull(),
  partiallyDamaged: integer("partially_damaged").notNull().default(0),
  totallyDamaged: integer("totally_damaged").notNull().default(0),
  estimatedLoss: real("estimated_loss").notNull().default(0),
  notes: text("notes").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertIncidentSchema = createInsertSchema(incidentsTable).omit({
  id: true,
  code: true,
  updatedAt: true,
});
export const insertEvacuationCenterSchema = createInsertSchema(
  evacuationCentersTable,
).omit({ id: true, updatedAt: true });
export const insertStructureDamageSchema = createInsertSchema(
  structureDamagesTable,
).omit({ id: true, updatedAt: true });

export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidentsTable.$inferSelect;
export type InsertEvacuationCenter = z.infer<
  typeof insertEvacuationCenterSchema
>;
export type EvacuationCenter = typeof evacuationCentersTable.$inferSelect;
export type InsertStructureDamage = z.infer<typeof insertStructureDamageSchema>;
export type StructureDamage = typeof structureDamagesTable.$inferSelect;