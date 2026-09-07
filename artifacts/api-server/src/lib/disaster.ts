import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import {
  getFirestore,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
  Timestamp,
} from "firebase-admin/firestore";
import type {
  EvacuationCenter,
  EvacuationCenterInput,
  Incident,
  IncidentInput,
  StructureDamage,
  StructureDamageInput,
} from "@workspace/api-zod";

const collectionNames = {
  incidents: "disaster_incidents",
  evacuationCenters: "disaster_evacuation_centers",
  structureDamages: "disaster_structure_damages",
  counters: "disaster_counters",
} as const;

let firestore: Firestore | undefined;
let seedPromise: Promise<void> | undefined;

function getDb(): Firestore {
  if (!firestore) {
    const projectId = process.env["FIREBASE_PROJECT_ID"];
    if (!projectId) {
      throw new Error("FIREBASE_PROJECT_ID must be set.");
    }
    if (!process.env["GOOGLE_APPLICATION_CREDENTIALS"]) {
      throw new Error("GOOGLE_APPLICATION_CREDENTIALS must be set.");
    }

    const app =
      getApps()[0] ??
      initializeApp({
        credential: applicationDefault(),
        projectId,
      });
    firestore = getFirestore(app);
  }
  return firestore;
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate();
  }
  return new Date(value as string | number);
}

function fromSnapshot<T>(snapshot: DocumentSnapshot<DocumentData>): T {
  const data = snapshot.data();
  if (!data) {
    throw new Error(`Firestore document ${snapshot.ref.path} has no data.`);
  }
  return {
    ...data,
    ...(data.startedAt !== undefined && { startedAt: asDate(data.startedAt) }),
    ...(data.updatedAt !== undefined && { updatedAt: asDate(data.updatedAt) }),
  } as T;
}

async function allocateId(collectionName: string): Promise<number> {
  const db = getDb();
  const counterRef = db.collection(collectionNames.counters).doc(collectionName);
  const records = db.collection(collectionName);

  return db.runTransaction(async (transaction) => {
    const counterSnapshot = await transaction.get(counterRef);
    const highestSnapshot = await transaction.get(
      records.orderBy("id", "desc").limit(1),
    );
    const currentCounter = Number(counterSnapshot.data()?.nextId ?? 1);
    const highestExistingId = highestSnapshot.empty
      ? 0
      : Number(highestSnapshot.docs[0].data().id ?? 0);
    const id = Math.max(currentCounter, highestExistingId + 1);
    transaction.set(counterRef, { nextId: id + 1 }, { merge: true });
    return id;
  });
}

async function findById(
  collectionName: string,
  id: number,
): Promise<DocumentSnapshot<DocumentData> | undefined> {
  const collection = getDb().collection(collectionName);
  const direct = await collection.doc(String(id)).get();
  if (direct.exists) return direct;

  const matching = await collection.where("id", "==", id).limit(1).get();
  return matching.docs[0];
}

async function deleteForIncident(
  collectionName: string,
  incidentId: number,
): Promise<void> {
  const records = await getDb()
    .collection(collectionName)
    .where("incidentId", "==", incidentId)
    .get();
  if (records.empty) return;

  const batch = getDb().batch();
  records.docs.forEach((record) => batch.delete(record.ref));
  await batch.commit();
}

function sortByUpdatedAt<T extends { updatedAt: Date }>(
  records: T[],
): T[] {
  return records.sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
  );
}

export async function ensureSeedData(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existing = await listIncidents();
      if (existing.length > 0) return;

      const flooding = await createIncident({
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
      }, "INC-2026-014");
      const earthquake = await createIncident({
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
      }, "INC-2026-013");

      await Promise.all([
        createEvacuationCenter({
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
        }),
        createEvacuationCenter({
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
        }),
        createEvacuationCenter({
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
        }),
        createStructureDamage({
          incidentId: flooding.id,
          structureType: "House",
          location: "Riverside",
          partiallyDamaged: 418,
          totallyDamaged: 62,
          estimatedLoss: 12400000,
          notes: "Initial barangay validation; pending second assessment.",
        }),
        createStructureDamage({
          incidentId: flooding.id,
          structureType: "Road",
          location: "South District",
          partiallyDamaged: 7,
          totallyDamaged: 1,
          estimatedLoss: 2900000,
          notes: "Two access roads remain passable to light vehicles.",
        }),
        createStructureDamage({
          incidentId: earthquake.id,
          structureType: "House",
          location: "Westview",
          partiallyDamaged: 138,
          totallyDamaged: 14,
          estimatedLoss: 8600000,
          notes: "Rapid visual assessment completed.",
        }),
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

export async function listIncidents(
  status?: Incident["status"],
  search?: string,
): Promise<Incident[]> {
  const snapshot = await getDb().collection(collectionNames.incidents).get();
  const normalizedSearch = search?.toLowerCase();
  return sortByUpdatedAt(
    snapshot.docs
      .map((document) => fromSnapshot<Incident>(document))
      .filter(
        (incident) =>
          (!status || incident.status === status) &&
          (!normalizedSearch ||
            [incident.title, incident.location, incident.code].some((value) =>
              value.toLowerCase().includes(normalizedSearch),
            )),
      ),
  );
}

export async function createIncident(
  input: IncidentInput,
  code?: string,
): Promise<Incident> {
  const id = await allocateId(collectionNames.incidents);
  const now = new Date();
  const incident: Incident = {
    id,
    code: code ?? `INC-${now.getFullYear()}-${String(id).padStart(3, "0")}`,
    title: input.title,
    incidentType: input.incidentType,
    status: input.status,
    severity: input.severity,
    location: input.location,
    startedAt: input.startedAt,
    updatedAt: now,
    summary: input.summary,
    affectedPopulation: input.affectedPopulation ?? 0,
    evacuatedPopulation: input.evacuatedPopulation ?? 0,
    deaths: input.deaths ?? 0,
    injuries: input.injuries ?? 0,
    missing: input.missing ?? 0,
    partiallyDamaged: 0,
    totallyDamaged: 0,
  };
  await getDb()
    .collection(collectionNames.incidents)
    .doc(String(id))
    .set(incident);
  return incident;
}

export async function getIncidentById(id: number): Promise<Incident | undefined> {
  const document = await findById(collectionNames.incidents, id);
  return document ? fromSnapshot<Incident>(document) : undefined;
}

export async function updateIncident(
  id: number,
  input: IncidentInput,
): Promise<Incident | undefined> {
  const document = await findById(collectionNames.incidents, id);
  if (!document) return undefined;
  const incident = {
    ...fromSnapshot<Incident>(document),
    ...input,
    id,
    updatedAt: new Date(),
  };
  await document.ref.set(incident);
  return incident;
}

export async function deleteIncident(id: number): Promise<boolean> {
  const document = await findById(collectionNames.incidents, id);
  if (!document) return false;
  await Promise.all([
    deleteForIncident(collectionNames.evacuationCenters, id),
    deleteForIncident(collectionNames.structureDamages, id),
  ]);
  await document.ref.delete();
  return true;
}

export async function listEvacuationCenters(
  incidentId?: number,
  search?: string,
): Promise<EvacuationCenter[]> {
  const snapshot = await getDb()
    .collection(collectionNames.evacuationCenters)
    .get();
  return snapshot.docs
    .map((document) => fromSnapshot<EvacuationCenter>(document))
    .filter(
      (center) =>
        (incidentId === undefined || center.incidentId === incidentId) &&
        (search === undefined || center.barangay === search),
    )
    .sort((left, right) => right.currentPopulation - left.currentPopulation);
}

export async function createEvacuationCenter(
  input: EvacuationCenterInput,
): Promise<EvacuationCenter> {
  const id = await allocateId(collectionNames.evacuationCenters);
  const center: EvacuationCenter = {
    ...input,
    id,
    updatedAt: new Date(),
  };
  await getDb()
    .collection(collectionNames.evacuationCenters)
    .doc(String(id))
    .set(center);
  await touchIncident(input.incidentId);
  return center;
}

export async function updateEvacuationCenter(
  id: number,
  input: EvacuationCenterInput,
): Promise<EvacuationCenter | undefined> {
  const document = await findById(collectionNames.evacuationCenters, id);
  if (!document) return undefined;
  const previous = fromSnapshot<EvacuationCenter>(document);
  const center: EvacuationCenter = {
    ...previous,
    ...input,
    id,
    updatedAt: new Date(),
  };
  await document.ref.set(center);
  await touchIncident(center.incidentId);
  return center;
}

export async function deleteEvacuationCenter(id: number): Promise<EvacuationCenter | undefined> {
  const document = await findById(collectionNames.evacuationCenters, id);
  if (!document) return undefined;
  const center = fromSnapshot<EvacuationCenter>(document);
  await document.ref.delete();
  await touchIncident(center.incidentId);
  return center;
}

export async function listStructureDamages(
  incidentId?: number,
): Promise<StructureDamage[]> {
  const snapshot = await getDb()
    .collection(collectionNames.structureDamages)
    .get();
  return snapshot.docs
    .map((document) => fromSnapshot<StructureDamage>(document))
    .filter(
      (damage) => incidentId === undefined || damage.incidentId === incidentId,
    )
    .sort((left, right) => right.totallyDamaged - left.totallyDamaged);
}

export async function createStructureDamage(
  input: StructureDamageInput,
): Promise<StructureDamage> {
  const id = await allocateId(collectionNames.structureDamages);
  const damage: StructureDamage = {
    ...input,
    id,
    updatedAt: new Date(),
  };
  await getDb()
    .collection(collectionNames.structureDamages)
    .doc(String(id))
    .set(damage);
  await touchIncident(input.incidentId);
  return damage;
}

export async function updateStructureDamage(
  id: number,
  input: StructureDamageInput,
): Promise<StructureDamage | undefined> {
  const document = await findById(collectionNames.structureDamages, id);
  if (!document) return undefined;
  const previous = fromSnapshot<StructureDamage>(document);
  const damage: StructureDamage = {
    ...previous,
    ...input,
    id,
    updatedAt: new Date(),
  };
  await document.ref.set(damage);
  await touchIncident(damage.incidentId);
  return damage;
}

export async function deleteStructureDamage(id: number): Promise<StructureDamage | undefined> {
  const document = await findById(collectionNames.structureDamages, id);
  if (!document) return undefined;
  const damage = fromSnapshot<StructureDamage>(document);
  await document.ref.delete();
  await touchIncident(damage.incidentId);
  return damage;
}

export async function getCentersForIncident(
  incidentId: number,
): Promise<EvacuationCenter[]> {
  return listEvacuationCenters(incidentId);
}

export async function getDamagesForIncident(
  incidentId: number,
): Promise<StructureDamage[]> {
  return listStructureDamages(incidentId);
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
    totalEvacuated: centers.reduce(
      (sum, center) => sum + center.currentPopulation,
      0,
    ),
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
    listIncidents(),
    listEvacuationCenters(),
    listStructureDamages(),
  ]);
  return {
    activeIncidents: incidents.filter((incident) => incident.status === "Active")
      .length,
    totalIncidents: incidents.length,
    totalEvacuationCenters: centers.length,
    totalEvacuated: centers.reduce(
      (sum, center) => sum + center.currentPopulation,
      0,
    ),
    totalCapacity: centers.reduce((sum, center) => sum + center.capacity, 0),
    totalFamilies: centers.reduce((sum, center) => sum + center.families, 0),
    partiallyDamaged: damages.reduce(
      (sum, damage) => sum + damage.partiallyDamaged,
      0,
    ),
    totallyDamaged: damages.reduce(
      (sum, damage) => sum + damage.totallyDamaged,
      0,
    ),
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

export async function touchIncident(incidentId: number): Promise<void> {
  const document = await findById(collectionNames.incidents, incidentId);
  if (document) await document.ref.update({ updatedAt: new Date() });
}
