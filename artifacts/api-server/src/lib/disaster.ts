import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  db,
  evacuationCentersTable,
  incidentsTable,
  structureDamagesTable,
} from "@workspace/db";

let seedPromise: Promise<void> | undefined;

export async function ensureSeedData(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existing = await db.select({ id: incidentsTable.id }).from(incidentsTable).limit(1);
      if (existing.length > 0) return;

      const [flooding] = await db
        .insert(incidentsTable)
        .values({
          code: "INC-2026-014",
          title: "South District Flooding",
          incidentType: "Flooding",
          status: "Active",
          severity: "High",
          location: "South District, San Isidro",
          startedAt: new Date("2026-08-31T03:40:00.000Z"),
          summary:
            "Continuous monsoon rain caused river overflow across low-lying barangays. Evacuation and relief operations remain active.",
          affectedPopulation: 12840,
          evacuatedPopulation: 2980,
          deaths: 1,
          injuries: 8,
          missing: 0,
        })
        .returning();
      const [earthquake] = await db
        .insert(incidentsTable)
        .values({
          code: "INC-2026-013",
          title: "Central Valley Earthquake",
          incidentType: "Earthquake",
          status: "Monitoring",
          severity: "Moderate",
          location: "Central Valley, San Isidro",
          startedAt: new Date("2026-08-29T12:15:00.000Z"),
          summary:
            "Aftershocks have subsided. Rapid assessments and temporary shelter support are underway in three barangays.",
          affectedPopulation: 4680,
          evacuatedPopulation: 642,
          deaths: 0,
          injuries: 16,
          missing: 0,
        })
        .returning();

      await db.insert(evacuationCentersTable).values([
        {
          incidentId: flooding.id,
          name: "San Isidro Elementary School",
          barangay: "San Isidro Proper",
          address: "Mabini Street",
          capacity: 1800,
          currentPopulation: 1240,
          families: 328,
          men: 384,
          women: 416,
          children: 390,
          seniors: 42,
          pwd: 8,
          status: "Open",
          contactPerson: "L. Ramos",
          contactNumber: "0917 555 0142",
        },
        {
          incidentId: flooding.id,
          name: "Barangay Hall — Riverside",
          barangay: "Riverside",
          address: "Riverside Road",
          capacity: 900,
          currentPopulation: 684,
          families: 176,
          men: 208,
          women: 227,
          children: 212,
          seniors: 31,
          pwd: 6,
          status: "Open",
          contactPerson: "M. Dela Cruz",
          contactNumber: "0918 555 0143",
        },
        {
          incidentId: earthquake.id,
          name: "Westview Covered Court",
          barangay: "Westview",
          address: "Westview Avenue",
          capacity: 800,
          currentPopulation: 642,
          families: 154,
          men: 196,
          women: 221,
          children: 198,
          seniors: 27,
          pwd: 4,
          status: "Open",
          contactPerson: "A. Villanueva",
          contactNumber: "0919 555 0144",
        },
      ]);

      await db.insert(structureDamagesTable).values([
        {
          incidentId: flooding.id,
          structureType: "House",
          location: "Riverside",
          partiallyDamaged: 418,
          totallyDamaged: 62,
          estimatedLoss: 12400000,
          notes: "Initial barangay validation; pending second assessment.",
        },
        {
          incidentId: flooding.id,
          structureType: "Road",
          location: "South District",
          partiallyDamaged: 7,
          totallyDamaged: 1,
          estimatedLoss: 2900000,
          notes: "Two access roads remain passable to light vehicles.",
        },
        {
          incidentId: earthquake.id,
          structureType: "House",
          location: "Westview",
          partiallyDamaged: 138,
          totallyDamaged: 14,
          estimatedLoss: 8600000,
          notes: "Rapid visual assessment completed.",
        },
      ]);
    })().catch((error) => {
      seedPromise = undefined;
      throw error;
    });
  }
  await seedPromise;
}

export function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function getIncidentById(id: number) {
  const [incident] = await db
    .select()
    .from(incidentsTable)
    .where(eq(incidentsTable.id, id));
  return incident;
}

export async function getCentersForIncident(incidentId: number) {
  return db
    .select()
    .from(evacuationCentersTable)
    .where(eq(evacuationCentersTable.incidentId, incidentId))
    .orderBy(desc(evacuationCentersTable.currentPopulation));
}

export async function getDamagesForIncident(incidentId: number) {
  return db
    .select()
    .from(structureDamagesTable)
    .where(eq(structureDamagesTable.incidentId, incidentId))
    .orderBy(desc(structureDamagesTable.totallyDamaged));
}

export function buildIncidentSearch(search: string | undefined) {
  if (!search) return undefined;
  return or(
    ilike(incidentsTable.title, `%${search}%`),
    ilike(incidentsTable.location, `%${search}%`),
    ilike(incidentsTable.code, `%${search}%`),
  );
}

export async function incidentOverview(id: number) {
  const incident = await getIncidentById(id);
  if (!incident) return undefined;
  const [centers, damages] = await Promise.all([
    getCentersForIncident(id),
    getDamagesForIncident(id),
  ]);
  return {
    incident,
    centers,
    damages,
    totalCenters: centers.length,
    totalEvacuated: centers.reduce((sum, center) => sum + center.currentPopulation, 0),
    totalCapacity: centers.reduce((sum, center) => sum + center.capacity, 0),
    totalFamilies: centers.reduce((sum, center) => sum + center.families, 0),
    totalPartiallyDamaged: damages.reduce(
      (sum, damage) => sum + damage.partiallyDamaged,
      0,
    ),
    totalTotallyDamaged: damages.reduce(
      (sum, damage) => sum + damage.totallyDamaged,
      0,
    ),
  };
}

export async function dashboardSummary() {
  const [incidents, centers, damages] = await Promise.all([
    db.select().from(incidentsTable).orderBy(desc(incidentsTable.updatedAt)),
    db.select().from(evacuationCentersTable),
    db.select().from(structureDamagesTable),
  ]);
  return {
    activeIncidents: incidents.filter((incident) => incident.status === "Active").length,
    totalIncidents: incidents.length,
    totalEvacuationCenters: centers.length,
    totalEvacuated: centers.reduce((sum, center) => sum + center.currentPopulation, 0),
    totalCapacity: centers.reduce((sum, center) => sum + center.capacity, 0),
    totalFamilies: centers.reduce((sum, center) => sum + center.families, 0),
    partiallyDamaged: damages.reduce((sum, damage) => sum + damage.partiallyDamaged, 0),
    totallyDamaged: damages.reduce((sum, damage) => sum + damage.totallyDamaged, 0),
    populationByIncident: incidents.map((incident) => ({
      incidentId: incident.id,
      label: incident.title,
      population: centers
        .filter((center) => center.incidentId === incident.id)
        .reduce((sum, center) => sum + center.currentPopulation, 0),
    })),
    recentIncidents: incidents.slice(0, 4),
  };
}

export async function touchIncident(incidentId: number) {
  await db
    .update(incidentsTable)
    .set({ updatedAt: new Date() })
    .where(eq(incidentsTable.id, incidentId));
}

export const incidentCountExpression = sql<number>`count(*)`;
export { and };