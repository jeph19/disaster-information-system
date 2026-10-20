import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query as firestoreQuery,
  runTransaction,
  setDoc,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { firebaseAuth, firebaseStorage, firestore } from './firebase';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';

export type IncidentStatus = 'Active' | 'Monitoring' | 'Closed';
export const IncidentStatus = { Active: 'Active', Monitoring: 'Monitoring', Closed: 'Closed' } as const;
export type IncidentType = 'Typhoon' | 'Flooding' | 'Earthquake' | 'Fire' | 'Landslide' | 'Other';
export const IncidentType = { Typhoon: 'Typhoon', Flooding: 'Flooding', Earthquake: 'Earthquake', Fire: 'Fire', Landslide: 'Landslide', Other: 'Other' } as const;
export type Severity = 'Low' | 'Moderate' | 'High' | 'Critical';
export const Severity = { Low: 'Low', Moderate: 'Moderate', High: 'High', Critical: 'Critical' } as const;
export type EvacuationCenterStatus = 'Open' | 'Full' | 'Closed';
export const EvacuationCenterStatus = { Open: 'Open', Full: 'Full', Closed: 'Closed' } as const;
export type StructureType = 'House' | 'School' | 'Road' | 'Bridge' | 'HealthFacility' | 'GovernmentBuilding' | 'Business' | 'Utility' | 'Other';
export const StructureType = { House: 'House', School: 'School', Road: 'Road', Bridge: 'Bridge', HealthFacility: 'HealthFacility', GovernmentBuilding: 'GovernmentBuilding', Business: 'Business', Utility: 'Utility', Other: 'Other' } as const;

export interface Incident {
  id: number; code: string; title: string; incidentType: IncidentType; status: IncidentStatus; severity: Severity;
  location: string; startedAt: string; updatedAt: string; summary: string; affectedPopulation: number;
  evacuatedPopulation: number; deaths: number; injuries: number; missing: number; partiallyDamaged: number; totallyDamaged: number;
  currentEvacuees?: number; cumulativeEvacuees?: number; evacuationTrackingInitialized?: boolean;
  lastEvacuationSnapshotAt?: string;
}
export interface IncidentInput {
  title: string; incidentType: IncidentType; status: IncidentStatus; severity: Severity; location: string;
  startedAt: string; summary: string; affectedPopulation?: number; evacuatedPopulation?: number;
  deaths?: number; injuries?: number; missing?: number;
}
export interface AgeSexCount { male: number; female: number; }
export type AgeSexBreakdown = Record<string, AgeSexCount>;
export type SectorBreakdown = Record<string, AgeSexCount>;
export interface EvacuationCenter {
  id: number; incidentId: number; name: string; barangay: string; address: string; capacity: number;
  currentPopulation: number; families: number; men: number; women: number; children: number; seniors: number;
  pwd: number; ageSex?: AgeSexBreakdown; sectors?: SectorBreakdown; status: EvacuationCenterStatus; contactPerson: string; contactNumber: string; updatedAt: string;
}
export interface EvacuationCenterInput {
  incidentId: number; name: string; barangay: string; address: string; capacity: number; currentPopulation: number;
  families: number; men: number; women: number; children: number; seniors: number; pwd: number;
  ageSex: AgeSexBreakdown; sectors: SectorBreakdown; status: EvacuationCenterStatus; contactPerson: string; contactNumber: string;
}
export interface StructureDamage {
  id: number; incidentId: number; structureType: StructureType; location: string; partiallyDamaged: number;
  totallyDamaged: number; estimatedLoss: number; notes: string; updatedAt: string;
}
export interface StructureDamageInput {
  incidentId: number; structureType: StructureType; location: string; partiallyDamaged: number;
  totallyDamaged: number; estimatedLoss: number; notes: string;
}
export interface IncidentOverview {
  incident: Incident; centers: EvacuationCenter[]; damages: StructureDamage[]; totalCenters: number;
  totalEvacuated: number; totalCapacity: number; totalFamilies: number; totalPartiallyDamaged: number; totalTotallyDamaged: number;
  evacuationHistory: EvacuationSnapshot[];
}
export interface DashboardSummary {
  activeIncidents: number; totalIncidents: number; totalEvacuationCenters: number; totalEvacuated: number;
  totalCumulativeEvacuees: number; trackedIncidentCount: number;
  totalCapacity: number; totalFamilies: number; partiallyDamaged: number; totallyDamaged: number;
  populationByIncident: { incidentId: number; label: string; population: number }[]; recentIncidents: Incident[];
}
export interface EvacuationSnapshot {
  id: string; incidentId: number; centerId?: number; transferToCenterId?: number;
  transferFromName?: string; transferToName?: string; transferredCount?: number;
  currentEvacuees: number; cumulativeEvacuees: number; change: number;
  changeType: 'created' | 'updated' | 'deleted' | 'transfer' | 'scheduled'; recordedAt: string;
}
export interface SituationalReportInput {
  incidentId: number; reportDate: string; preparedBy: string; operationalSummary: string;
  priorityNeeds: string; actionsTaken: string; nextSteps: string; organization: OrganizationProfile;
}
export interface SituationalReport {
  id: string; revision: number; reportNumber: string; generatedAt: string; reportDate: string; preparedBy: string;
  organization: OrganizationProfile; incident: Incident;
  centers: EvacuationCenter[]; damages: StructureDamage[]; photos: IncidentPhoto[]; evacuationHistory: EvacuationSnapshot[];
  operationalSummary: string; priorityNeeds: string;
  actionsTaken: string; nextSteps: string;
}
export type UserRole = 'Administrator' | 'Coordinator' | 'Viewer';
export interface FirestoreUser { id: string; name: string; email: string; role: UserRole; status: 'Active' | 'Disabled'; createdAt: string; }
export interface OrganizationProfile { municipality: string; desk: string; officer: string; email: string; timezone: string; }
export interface AuditLog { id: string; recordType: string; recordId: string; incidentId?: number; action: 'created' | 'updated' | 'deleted'; changedAt: string; changedBy: string; changedByName: string; before?: unknown; after?: unknown; }
export interface IncidentPhoto { id: string; incidentId: number; name: string; url: string; storagePath: string; uploadedAt: string; uploadedBy: string; uploadedByName: string; }

const names = {
  incidents: 'disaster_incidents',
  centers: 'disaster_evacuation_centers',
  damages: 'disaster_structure_damages',
  evacuationHistory: 'disaster_evacuation_snapshots',
  reports: 'disaster_situational_reports',
  reportSequences: 'disaster_situational_report_sequences',
  users: 'disaster_users',
  settings: 'disaster_settings',
} as const;

const asIso = (value: unknown): string => {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return (value.toDate() as Date).toISOString();
  }
  return value instanceof Date ? value.toISOString() : String(value ?? '');
};

const serialize = (value: unknown): unknown => value instanceof Date ? Timestamp.fromDate(value) : value;
const dateValue = (value: string | Date) => value instanceof Date ? value : new Date(value);
const actor = () => ({ changedBy: firebaseAuth.currentUser?.uid ?? 'unknown', changedByName: firebaseAuth.currentUser?.displayName || firebaseAuth.currentUser?.email || 'Unknown user' });
const writeAudit = (batch: ReturnType<typeof writeBatch>, recordType: string, recordId: number | string, action: AuditLog['action'], incidentId: number, before?: unknown, after?: unknown) => {
  const entry = auditEntry(recordType, recordId, action, incidentId, before, after);
  batch.set(entry.ref, entry.data);
};
const auditEntry = (recordType: string, recordId: number | string, action: AuditLog['action'], incidentId: number, before?: unknown, after?: unknown) => {
  const current = actor();
  const ref = doc(collection(firestore, 'disaster_audit_logs'));
  return { ref, data: {
    id: ref.id, recordType, recordId: String(recordId), incidentId, action, changedAt: serverTimestamp(), ...current,
    ...(before === undefined ? {} : { before }),
    ...(after === undefined ? {} : { after }),
  } };
};

async function records<T>(name: string): Promise<T[]> {
  const snapshot = await getDocs(collection(firestore, name));
  return snapshot.docs.map(item => {
    const data = item.data() as Record<string, unknown>;
    for (const field of ['startedAt', 'updatedAt', 'createdAt', 'generatedAt', 'reportDate', 'changedAt', 'uploadedAt', 'lastEvacuationSnapshotAt']) {
      if (field in data) data[field] = asIso(data[field]);
    }
    return data as T;
  });
}

const evacuationSnapshotIntervalMs = 15 * 60 * 1000;
export async function recordScheduledEvacuationSnapshots(): Promise<void> {
  const incidents = (await listIncidents()).filter(incident => incident.status === 'Active' || incident.status === 'Monitoring');
  for (const incident of incidents) {
    const incidentRef = doc(firestore, names.incidents, String(incident.id));
    const initial = await getDoc(incidentRef);
    if (!initial.exists()) continue;
    const initialData = initial.data();
    const lastSnapshot = initialData.lastEvacuationSnapshotAt ? new Date(asIso(initialData.lastEvacuationSnapshotAt)).getTime() : 0;
    if (lastSnapshot && Date.now() - lastSnapshot < evacuationSnapshotIntervalMs) continue;
    const legacyCenters = initialData.evacuationTrackingInitialized === true
      ? undefined
      : await getDocs(firestoreQuery(collection(firestore, names.centers), where('incidentId', '==', incident.id)));
    const legacyCurrent = legacyCenters?.docs.reduce((sum, center) => sum + (Number(center.data().currentPopulation) || 0), 0) ?? 0;

    await runTransaction(firestore, async transaction => {
      const currentIncident = await transaction.get(incidentRef);
      if (!currentIncident.exists()) return;
      const data = currentIncident.data();
      if (data.status !== 'Active' && data.status !== 'Monitoring') return;
      const alreadyTracked = data.evacuationTrackingInitialized === true;
      const last = data.lastEvacuationSnapshotAt ? new Date(asIso(data.lastEvacuationSnapshotAt)).getTime() : 0;
      if (last && Date.now() - last < evacuationSnapshotIntervalMs) return;
      const currentEvacuees = alreadyTracked ? Number(data.currentEvacuees) || 0 : legacyCurrent;
      const cumulativeEvacuees = alreadyTracked ? Number(data.cumulativeEvacuees) || 0 : currentEvacuees;
      const timestamp = Timestamp.now();
      const snapshotRef = doc(collection(firestore, names.evacuationHistory));
      transaction.set(incidentRef, {
        currentEvacuees,
        evacuatedPopulation: currentEvacuees,
        cumulativeEvacuees,
        evacuationTrackingInitialized: true,
        lastEvacuationSnapshotAt: timestamp,
      }, { merge: true });
      transaction.set(snapshotRef, {
        id: snapshotRef.id,
        incidentId: incident.id,
        currentEvacuees,
        cumulativeEvacuees,
        change: 0,
        changeType: 'scheduled',
        recordedAt: serverTimestamp(),
      });
    });
  }
}

async function nextId(name: string): Promise<number> {
  const existing = await records<{ id: number }>(name);
  return existing.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

async function putRecord(name: string, id: number, value: Record<string, unknown>) {
  await setDoc(doc(firestore, name, String(id)), Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)])));
}

const seedIncidents: Incident[] = [
  { id: 13, code: 'INC-2026-013', title: 'Central Valley Earthquake', incidentType: 'Earthquake', status: 'Monitoring', severity: 'Moderate', location: 'Central Valley, San Isidro', startedAt: '2026-08-29T12:15:00.000Z', updatedAt: '2026-08-29T12:15:00.000Z', summary: 'Aftershocks have subsided. Rapid assessments and temporary shelter support are underway in three barangays.', affectedPopulation: 4680, evacuatedPopulation: 642, deaths: 0, injuries: 16, missing: 0, partiallyDamaged: 0, totallyDamaged: 0 },
  { id: 14, code: 'INC-2026-014', title: 'South District Flooding', incidentType: 'Flooding', status: 'Active', severity: 'High', location: 'South District, San Isidro', startedAt: '2026-08-31T03:40:00.000Z', updatedAt: '2026-08-31T03:40:00.000Z', summary: 'Continuous monsoon rain caused river overflow across low-lying barangays. Evacuation and relief operations remain active.', affectedPopulation: 12840, evacuatedPopulation: 2980, deaths: 1, injuries: 8, missing: 0, partiallyDamaged: 0, totallyDamaged: 0 },
];
const seedCenters: EvacuationCenter[] = [
  { id: 1, incidentId: 14, name: 'San Isidro Elementary School', barangay: 'San Isidro Proper', address: 'Mabini Street', capacity: 1800, currentPopulation: 1240, families: 328, men: 384, women: 416, children: 390, seniors: 42, pwd: 8, status: 'Open', contactPerson: 'L. Ramos', contactNumber: '0917 555 0142', updatedAt: '2026-08-31T03:40:00.000Z' },
  { id: 2, incidentId: 14, name: 'Barangay Hall — Riverside', barangay: 'Riverside', address: 'Riverside Road', capacity: 900, currentPopulation: 684, families: 176, men: 208, women: 227, children: 212, seniors: 31, pwd: 6, status: 'Open', contactPerson: 'M. Dela Cruz', contactNumber: '0918 555 0143', updatedAt: '2026-08-31T03:40:00.000Z' },
  { id: 3, incidentId: 13, name: 'Westview Covered Court', barangay: 'Westview', address: 'Westview Avenue', capacity: 800, currentPopulation: 642, families: 154, men: 196, women: 221, children: 198, seniors: 27, pwd: 4, status: 'Open', contactPerson: 'A. Villanueva', contactNumber: '0919 555 0144', updatedAt: '2026-08-31T03:40:00.000Z' },
];
const seedDamages: StructureDamage[] = [
  { id: 1, incidentId: 14, structureType: 'House', location: 'Riverside', partiallyDamaged: 418, totallyDamaged: 62, estimatedLoss: 12400000, notes: 'Initial barangay validation; pending second assessment.', updatedAt: '2026-08-31T03:40:00.000Z' },
  { id: 2, incidentId: 14, structureType: 'Road', location: 'South District', partiallyDamaged: 7, totallyDamaged: 1, estimatedLoss: 2900000, notes: 'Two access roads remain passable to light vehicles.', updatedAt: '2026-08-31T03:40:00.000Z' },
  { id: 3, incidentId: 13, structureType: 'House', location: 'Westview', partiallyDamaged: 138, totallyDamaged: 14, estimatedLoss: 8600000, notes: 'Rapid visual assessment completed.', updatedAt: '2026-08-31T03:40:00.000Z' },
];

let seedPromise: Promise<void> | undefined;
export async function ensureSeedData(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const seedMarker = await getDoc(doc(firestore, names.settings, 'seed_status'));
      if (seedMarker.exists()) return;
      const existing = await records<Incident>(names.incidents);
      if (existing.length) {
        await setDoc(doc(firestore, names.settings, 'seed_status'), { initialized: true });
        return;
      }
      await Promise.all(seedIncidents.map(item => putRecord(names.incidents, item.id, { ...item, startedAt: dateValue(item.startedAt), updatedAt: dateValue(item.updatedAt) })));
      await Promise.all(seedCenters.map(item => putRecord(names.centers, item.id, { ...item, updatedAt: dateValue(item.updatedAt) })));
      await Promise.all(seedDamages.map(item => putRecord(names.damages, item.id, { ...item, updatedAt: dateValue(item.updatedAt) })));
      await setDoc(doc(firestore, names.settings, 'seed_status'), { initialized: true });
    })().catch(error => { seedPromise = undefined; throw error; });
  }
  await seedPromise;
}

export async function listIncidents(params?: { status?: IncidentStatus; search?: string }): Promise<Incident[]> {
  await ensureSeedData();
  const search = params?.search?.toLowerCase();
  return (await records<Incident>(names.incidents)).filter(item =>
    (!params?.status || item.status === params.status) &&
    (!search || [item.title, item.location, item.code].some(value => value.toLowerCase().includes(search))),
  ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
export async function getIncident(id: number): Promise<Incident | undefined> { return (await listIncidents()).find(item => item.id === id); }
export async function createIncident(input: IncidentInput): Promise<Incident> {
  await ensureSeedData();
  const id = await nextId(names.incidents); const now = new Date();
  const item: Incident = { id, code: `INC-${now.getFullYear()}-${String(id).padStart(3, '0')}`, ...input, startedAt: input.startedAt, updatedAt: now.toISOString(), affectedPopulation: input.affectedPopulation ?? 0, evacuatedPopulation: input.evacuatedPopulation ?? 0, deaths: input.deaths ?? 0, injuries: input.injuries ?? 0, missing: input.missing ?? 0, partiallyDamaged: 0, totallyDamaged: 0 };
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, names.incidents, String(id)), { ...item, startedAt: dateValue(item.startedAt), updatedAt: now });
  writeAudit(batch, 'incident', id, 'created', id, undefined, item);
  await batch.commit(); return item;
}
export async function updateIncident(id: number, input: IncidentInput): Promise<Incident | undefined> {
  const previous = await getIncident(id); if (!previous) return undefined;
  const item = { ...previous, ...input, id, updatedAt: new Date().toISOString() };
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, names.incidents, String(id)), { ...item, startedAt: dateValue(item.startedAt), updatedAt: dateValue(item.updatedAt) });
  writeAudit(batch, 'incident', id, 'updated', id, previous, item);
  await batch.commit(); return item;
}
export async function deleteIncident(id: number): Promise<boolean> {
  const previous = await getIncident(id); if (!previous) return false;
  const [centers, damages, history] = await Promise.all([
    records<EvacuationCenter>(names.centers),
    records<StructureDamage>(names.damages),
    getDocs(firestoreQuery(collection(firestore, names.evacuationHistory), where('incidentId', '==', id))),
  ]);
  for (let offset = 0; offset < history.docs.length; offset += 450) {
    const historyBatch = writeBatch(firestore);
    history.docs.slice(offset, offset + 450).forEach(item => historyBatch.delete(item.ref));
    await historyBatch.commit();
  }
  const batch = writeBatch(firestore);
  centers.filter(item => item.incidentId === id).forEach(item => {
    batch.delete(doc(firestore, names.centers, String(item.id)));
    writeAudit(batch, 'evacuation_center', item.id, 'deleted', id, item);
  });
  damages.filter(item => item.incidentId === id).forEach(item => {
    batch.delete(doc(firestore, names.damages, String(item.id)));
    writeAudit(batch, 'structure_damage', item.id, 'deleted', id, item);
  });
  batch.delete(doc(firestore, names.incidents, String(id)));
  writeAudit(batch, 'incident', id, 'deleted', id, previous);
  await batch.commit();
  return true;
}
export async function listEvacuationCenters(params?: { incidentId?: number; search?: string }): Promise<EvacuationCenter[]> {
  await ensureSeedData(); return (await records<EvacuationCenter>(names.centers)).filter(item => (params?.incidentId === undefined || item.incidentId === params.incidentId) && (!params?.search || item.barangay === params.search)).sort((a, b) => b.currentPopulation - a.currentPopulation);
}
export async function createEvacuationCenter(input: EvacuationCenterInput): Promise<EvacuationCenter> {
  await ensureSeedData();
  const item = { ...input, id: await nextId(names.centers), updatedAt: new Date().toISOString() };
  await saveEvacuationCenter(item, 'created');
  return item;
}
export async function updateEvacuationCenter(id: number, input: EvacuationCenterInput): Promise<EvacuationCenter | undefined> {
  const previous = (await listEvacuationCenters()).find(item => item.id === id); if (!previous) return undefined;
  if (input.incidentId !== previous.incidentId) throw new Error('An evacuation center cannot be moved to a different incident.');
  const item = { ...previous, ...input, id, updatedAt: new Date().toISOString() };
  await saveEvacuationCenter(item, 'updated', previous);
  return item;
}
export async function deleteEvacuationCenter(id: number): Promise<EvacuationCenter | undefined> {
  const item = (await listEvacuationCenters()).find(record => record.id === id); if (!item) return undefined;
  await saveEvacuationCenter(item, 'deleted', item);
  return item;
}

async function saveEvacuationCenter(
  item: EvacuationCenter,
  changeType: AuditLog['action'],
  previous?: EvacuationCenter,
): Promise<void> {
  const incidentRef = doc(firestore, names.incidents, String(item.incidentId));
  const centerRef = doc(firestore, names.centers, String(item.id));
  const now = new Date();
  const timestamp = Timestamp.fromDate(now);
  const initialIncident = await getDoc(incidentRef);
  if (!initialIncident.exists()) throw new Error('The linked incident no longer exists.');
  const initialCenters = initialIncident.data().evacuationTrackingInitialized === true
    ? undefined
    : await getDocs(firestoreQuery(collection(firestore, names.centers), where('incidentId', '==', item.incidentId)));
  const legacyCurrent = initialCenters?.docs.reduce((sum, center) => sum + (Number(center.data().currentPopulation) || 0), 0) ?? 0;
  await runTransaction(firestore, async transaction => {
    const [incidentSnapshot, centerSnapshot] = await Promise.all([
      transaction.get(incidentRef),
      transaction.get(centerRef),
    ]);
    if (!incidentSnapshot.exists()) throw new Error('The linked incident no longer exists.');
    if (changeType === 'created' && centerSnapshot.exists()) throw new Error('The evacuation center ID is already in use. Refresh and try again.');
    if (changeType !== 'created' && !centerSnapshot.exists()) throw new Error('The evacuation center no longer exists. Refresh and try again.');

    const incidentData = incidentSnapshot.data();
    const trackingInitialized = incidentData.evacuationTrackingInitialized === true;
    const previousCurrent = trackingInitialized ? Number(incidentData.currentEvacuees) || 0 : legacyCurrent;
    const oldPopulation = changeType === 'created' ? 0 : Number(centerSnapshot.data()?.currentPopulation) || 0;
    const nextPopulation = changeType === 'created' ? item.currentPopulation : changeType === 'deleted' ? 0 : item.currentPopulation;
    const nextCurrent = Math.max(0, previousCurrent - oldPopulation + nextPopulation);
    const baselineCumulative = trackingInitialized
      ? Number(incidentData.cumulativeEvacuees) || 0
      : previousCurrent;
    const cumulative = baselineCumulative + Math.max(0, nextCurrent - previousCurrent);
    const snapshotRef = doc(collection(firestore, names.evacuationHistory));
    const audit = auditEntry('evacuation_center', item.id, changeType, item.incidentId, previous, changeType === 'deleted' ? undefined : item);

    if (changeType === 'deleted') transaction.delete(centerRef);
    else transaction.set(centerRef, { ...item, updatedAt: timestamp });
    transaction.set(incidentRef, {
      currentEvacuees: nextCurrent,
      evacuatedPopulation: nextCurrent,
      cumulativeEvacuees: cumulative,
      evacuationTrackingInitialized: true,
      lastEvacuationSnapshotAt: timestamp,
    }, { merge: true });
    transaction.set(snapshotRef, {
      id: snapshotRef.id,
      incidentId: item.incidentId,
      centerId: item.id,
      currentEvacuees: nextCurrent,
      cumulativeEvacuees: cumulative,
      change: nextCurrent - previousCurrent,
      changeType,
      recordedAt: timestamp,
    });
    transaction.set(audit.ref, audit.data);
  });
}

export async function transferEvacuees(input: {
  incidentId: number;
  sourceCenterId: number;
  destinationCenterId: number;
  count: number;
}): Promise<void> {
  if (input.sourceCenterId === input.destinationCenterId) throw new Error('Choose two different evacuation centers.');
  if (!Number.isInteger(input.count) || input.count <= 0) throw new Error('Enter a transfer count greater than zero.');
  const incidentRef = doc(firestore, names.incidents, String(input.incidentId));
  const sourceRef = doc(firestore, names.centers, String(input.sourceCenterId));
  const destinationRef = doc(firestore, names.centers, String(input.destinationCenterId));
  const [incident, initialSource, initialDestination] = await Promise.all([
    getDoc(incidentRef),
    getDoc(sourceRef),
    getDoc(destinationRef),
  ]);
  if (!incident.exists()) throw new Error('The linked incident no longer exists.');
  if (!initialSource.exists() || !initialDestination.exists()) throw new Error('One of the selected evacuation centers no longer exists.');
  if (initialSource.data().incidentId !== input.incidentId || initialDestination.data().incidentId !== input.incidentId) {
    throw new Error('Both centers must belong to the selected incident.');
  }
  const legacyCenters = incident.data().evacuationTrackingInitialized === true
    ? undefined
    : await getDocs(firestoreQuery(collection(firestore, names.centers), where('incidentId', '==', input.incidentId)));
  const legacyCurrent = legacyCenters?.docs.reduce((sum, center) => sum + (Number(center.data().currentPopulation) || 0), 0) ?? 0;
  const timestamp = Timestamp.now();
  await runTransaction(firestore, async transaction => {
    const [incidentSnapshot, sourceSnapshot, destinationSnapshot] = await Promise.all([
      transaction.get(incidentRef),
      transaction.get(sourceRef),
      transaction.get(destinationRef),
    ]);
    if (!incidentSnapshot.exists() || !sourceSnapshot.exists() || !destinationSnapshot.exists()) {
      throw new Error('The incident or one of the centers no longer exists.');
    }
    const source = sourceSnapshot.data() as EvacuationCenter;
    const destination = destinationSnapshot.data() as EvacuationCenter;
    const sourcePopulation = Number(source.currentPopulation) || 0;
    const destinationPopulation = Number(destination.currentPopulation) || 0;
    if (sourcePopulation < input.count) throw new Error('The source center does not have enough evacuees for this transfer.');
    const incidentData = incidentSnapshot.data();
    const currentEvacuees = incidentData.evacuationTrackingInitialized === true
      ? Number(incidentData.currentEvacuees) || 0
      : legacyCurrent;
    const cumulativeEvacuees = incidentData.evacuationTrackingInitialized === true
      ? Number(incidentData.cumulativeEvacuees) || 0
      : currentEvacuees;
    const snapshotRef = doc(collection(firestore, names.evacuationHistory));
    const transfer = {
      incidentId: input.incidentId,
      sourceCenterId: input.sourceCenterId,
      destinationCenterId: input.destinationCenterId,
      sourceCenterName: source.name,
      destinationCenterName: destination.name,
      count: input.count,
      recordedAt: timestamp.toDate().toISOString(),
    };
    const audit = auditEntry('evacuation_transfer', snapshotRef.id, 'updated', input.incidentId, undefined, transfer);
    transaction.set(sourceRef, { currentPopulation: sourcePopulation - input.count, updatedAt: timestamp }, { merge: true });
    transaction.set(destinationRef, { currentPopulation: destinationPopulation + input.count, updatedAt: timestamp }, { merge: true });
    transaction.set(incidentRef, {
      currentEvacuees,
      evacuatedPopulation: currentEvacuees,
      cumulativeEvacuees,
      evacuationTrackingInitialized: true,
      lastEvacuationSnapshotAt: timestamp,
    }, { merge: true });
    transaction.set(snapshotRef, {
      id: snapshotRef.id,
      incidentId: input.incidentId,
      centerId: input.sourceCenterId,
      transferToCenterId: input.destinationCenterId,
      transferFromName: source.name,
      transferToName: destination.name,
      transferredCount: input.count,
      currentEvacuees,
      cumulativeEvacuees,
      change: 0,
      changeType: 'transfer',
      recordedAt: serverTimestamp(),
    });
    transaction.set(audit.ref, audit.data);
  });
}

export async function listStructureDamages(params?: { incidentId?: number }): Promise<StructureDamage[]> {
  await ensureSeedData(); return (await records<StructureDamage>(names.damages)).filter(item => params?.incidentId === undefined || item.incidentId === params.incidentId).sort((a, b) => b.totallyDamaged - a.totallyDamaged);
}
export async function createStructureDamage(input: StructureDamageInput): Promise<StructureDamage> {
  await ensureSeedData();
  const item = { ...input, id: await nextId(names.damages), updatedAt: new Date().toISOString() };
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, names.damages, String(item.id)), { ...item, updatedAt: dateValue(item.updatedAt) });
  writeAudit(batch, 'structure_damage', item.id, 'created', item.incidentId, undefined, item);
  await batch.commit(); return item;
}
export async function updateStructureDamage(id: number, input: StructureDamageInput): Promise<StructureDamage | undefined> {
  const previous = (await listStructureDamages()).find(item => item.id === id); if (!previous) return undefined;
  const item = { ...previous, ...input, id, updatedAt: new Date().toISOString() };
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, names.damages, String(id)), { ...item, updatedAt: dateValue(item.updatedAt) });
  writeAudit(batch, 'structure_damage', id, 'updated', item.incidentId, previous, item);
  await batch.commit(); return item;
}
export async function deleteStructureDamage(id: number): Promise<StructureDamage | undefined> {
  const item = (await listStructureDamages()).find(record => record.id === id); if (!item) return undefined;
  const batch = writeBatch(firestore);
  batch.delete(doc(firestore, names.damages, String(id)));
  writeAudit(batch, 'structure_damage', id, 'deleted', item.incidentId, item);
  await batch.commit(); return item;
}
export async function listIncidentAuditLogs(incidentId: number): Promise<AuditLog[]> {
  const snapshot = await getDocs(firestoreQuery(collection(firestore, 'disaster_audit_logs'), where('incidentId', '==', incidentId)));
  return snapshot.docs.map(entry => {
    const data = entry.data();
    return { ...data, id: entry.id, changedAt: asIso(data.changedAt) } as AuditLog;
  }).sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
}
export async function listIncidentPhotos(incidentId: number): Promise<IncidentPhoto[]> {
  return (await records<IncidentPhoto>('disaster_incident_photos')).filter(photo => photo.incidentId === incidentId).sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}
export async function uploadIncidentPhoto(incidentId: number, file: File): Promise<IncidentPhoto> {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Upload a JPEG, PNG, WebP, or GIF image.');
  if (file.size === 0) throw new Error('The selected image is empty.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Images must be smaller than 10 MB.');
  const current = firebaseAuth.currentUser;
  if (!current) throw new Error('You must be signed in to upload a photo.');
  const storagePath = `incidents/${incidentId}/${crypto.randomUUID()}-${file.name}`;
  await uploadBytes(ref(firebaseStorage, storagePath), file, { contentType: file.type });
  try {
    const photo: IncidentPhoto = { id: crypto.randomUUID(), incidentId, name: file.name, url: await getDownloadURL(ref(firebaseStorage, storagePath)), storagePath, uploadedAt: new Date().toISOString(), uploadedBy: current.uid, uploadedByName: current.displayName || current.email || 'Unknown user' };
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, 'disaster_incident_photos', photo.id), { ...photo, uploadedAt: serverTimestamp() });
    writeAudit(batch, 'incident_photo', photo.id, 'created', incidentId, undefined, photo);
    await batch.commit();
    return photo;
  } catch (error) {
    try {
      await deleteObject(ref(firebaseStorage, storagePath));
    } catch (cleanupError) {
      throw new Error(`Photo metadata could not be saved, and the uploaded file could not be removed: ${String(cleanupError)}`);
    }
    throw error;
  }
}
export async function deleteIncidentPhoto(photo: IncidentPhoto): Promise<void> {
  const batch = writeBatch(firestore);
  batch.delete(doc(firestore, 'disaster_incident_photos', photo.id));
  writeAudit(batch, 'incident_photo', photo.id, 'deleted', photo.incidentId, photo);
  await batch.commit();
  await deleteObject(ref(firebaseStorage, photo.storagePath));
}
export async function getIncidentOverview(id: number): Promise<IncidentOverview | undefined> {
  const incident = await getIncident(id); if (!incident) return undefined;
  const [centers, damages, evacuationHistory] = await Promise.all([
    listEvacuationCenters({ incidentId: id }),
    listStructureDamages({ incidentId: id }),
    listEvacuationHistory(id),
  ]);
  return { incident, centers, damages, evacuationHistory, totalCenters: centers.length, totalEvacuated: centers.reduce((sum, item) => sum + item.currentPopulation, 0), totalCapacity: centers.reduce((sum, item) => sum + item.capacity, 0), totalFamilies: centers.reduce((sum, item) => sum + item.families, 0), totalPartiallyDamaged: damages.reduce((sum, item) => sum + item.partiallyDamaged, 0), totalTotallyDamaged: damages.reduce((sum, item) => sum + item.totallyDamaged, 0) };
}
export async function listEvacuationHistory(incidentId: number): Promise<EvacuationSnapshot[]> {
  const snapshot = await getDocs(firestoreQuery(collection(firestore, names.evacuationHistory), where('incidentId', '==', incidentId)));
  return snapshot.docs.map(entry => {
    const data = entry.data();
    return { ...data, id: entry.id, recordedAt: asIso(data.recordedAt) } as EvacuationSnapshot;
  }).sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
}
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [incidents, centers, damages] = await Promise.all([listIncidents(), listEvacuationCenters(), listStructureDamages()]);
  const trackedIncidents = incidents.filter(item => item.evacuationTrackingInitialized);
  return { activeIncidents: incidents.filter(item => item.status === 'Active').length, totalIncidents: incidents.length, totalEvacuationCenters: centers.length, totalEvacuated: centers.reduce((sum, item) => sum + item.currentPopulation, 0), totalCumulativeEvacuees: trackedIncidents.reduce((sum, item) => sum + (item.cumulativeEvacuees ?? 0), 0), trackedIncidentCount: trackedIncidents.length, totalCapacity: centers.reduce((sum, item) => sum + item.capacity, 0), totalFamilies: centers.reduce((sum, item) => sum + item.families, 0), partiallyDamaged: damages.reduce((sum, item) => sum + item.partiallyDamaged, 0), totallyDamaged: damages.reduce((sum, item) => sum + item.totallyDamaged, 0), populationByIncident: incidents.map(item => ({ incidentId: item.id, label: item.title, population: centers.filter(center => center.incidentId === item.id).reduce((sum, center) => sum + center.currentPopulation, 0) })), recentIncidents: incidents.slice(0, 4) };
}
export async function generateSituationalReport(input: SituationalReportInput): Promise<SituationalReport> {
  const incident = await getIncident(input.incidentId); if (!incident) throw new Error('Incident not found');
  const [centers, damages, photos, evacuationHistory] = await Promise.all([listEvacuationCenters({ incidentId: input.incidentId }), listStructureDamages({ incidentId: input.incidentId }), listIncidentPhotos(input.incidentId), listEvacuationHistory(input.incidentId)]);
  const reportRef = doc(collection(firestore, names.reports));
  const sequenceRef = doc(firestore, names.reportSequences, String(input.incidentId));
  const generatedAt = new Date().toISOString();
  let report: SituationalReport | undefined;
  await runTransaction(firestore, async transaction => {
    const sequenceSnapshot = await transaction.get(sequenceRef);
    const revision = (Number(sequenceSnapshot.data()?.revision) || 0) + 1;
    report = {
      ...input,
      id: reportRef.id,
      revision,
      reportNumber: `SITREP-${new Date(generatedAt).getFullYear()}-${String(input.incidentId).padStart(3, '0')}-R${String(revision).padStart(2, '0')}`,
      generatedAt,
      incident,
      centers,
      damages,
      photos,
      evacuationHistory,
    };
    const audit = auditEntry('situational_report', report.id, 'created', input.incidentId, undefined, {
      reportNumber: report.reportNumber,
      revision: report.revision,
      generatedAt: report.generatedAt,
    });
    transaction.set(sequenceRef, { incidentId: input.incidentId, revision }, { merge: true });
    transaction.set(reportRef, { ...report, generatedAt: dateValue(report.generatedAt), archivedAt: serverTimestamp() });
    transaction.set(audit.ref, audit.data);
  });
  if (!report) throw new Error('The situation report could not be archived.');
  return report;
}
export async function listSituationalReports(incidentId: number): Promise<SituationalReport[]> {
  const snapshot = await getDocs(firestoreQuery(collection(firestore, names.reports), where('incidentId', '==', incidentId)));
  return snapshot.docs.map(entry => {
    const data = entry.data();
    return { ...data, id: entry.id, generatedAt: asIso(data.generatedAt) } as SituationalReport;
  }).sort((a, b) => b.revision - a.revision);
}
export async function upsertUser(user: FirestoreUser): Promise<void> { await setDoc(doc(firestore, names.users, user.id), { ...user, createdAt: dateValue(user.createdAt) }, { merge: true }); }
export async function updateUserRole(id: string, role: UserRole): Promise<void> { await setDoc(doc(firestore, names.users, id), { role }, { merge: true }); }
export async function listUsers(): Promise<FirestoreUser[]> {
  return records<FirestoreUser>(names.users);
}
export async function getUser(id: string): Promise<FirestoreUser | undefined> {
  return (await listUsers()).find(user => user.id === id);
}
export async function getOrganizationProfile(): Promise<OrganizationProfile | undefined> {
  const snapshot = await getDoc(doc(firestore, names.settings, 'organization'));
  return snapshot.exists() ? snapshot.data() as OrganizationProfile : undefined;
}
export async function saveOrganizationProfile(profile: OrganizationProfile): Promise<void> {
  await setDoc(doc(firestore, names.settings, 'organization'), profile);
}

const key = (name: string, value?: unknown) => [name, value] as const;
export const getGetDashboardSummaryQueryKey = () => ['firestore', 'dashboard'] as const;
export const getGetIncidentOverviewQueryKey = (id: number) => key('firestore-incident-overview', id);
export const getGetIncidentQueryKey = (id: number) => key('firestore-incident', id);
export const getListIncidentsQueryKey = (params?: unknown) => key('firestore-incidents', params);
export const getListEvacuationCentersQueryKey = (params?: unknown) => key('firestore-centers', params);
export const getListStructureDamagesQueryKey = (params?: unknown) => key('firestore-damages', params);
export const getListUsersQueryKey = () => ['firestore', 'users'] as const;
type QueryOptions = { query?: Record<string, unknown> };
const query = <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>, options?: QueryOptions): UseQueryResult<T> => useQuery<T, Error>({ queryKey, queryFn, ...(options?.query ?? {}) } as never);
export const useHealthCheck = (options?: QueryOptions) => query(['firestore-health'], async () => { await getDocs(collection(firestore, names.incidents)); return { status: 'ok' }; }, options);
export const useGetDashboardSummary = (options?: QueryOptions) => query(getGetDashboardSummaryQueryKey(), getDashboardSummary, options);
export const useListIncidents = (params?: { status?: IncidentStatus; search?: string }, options?: QueryOptions) => query(getListIncidentsQueryKey(params), () => listIncidents(params), options);
export const useGetIncident = (id: number, options?: QueryOptions) => query(getGetIncidentQueryKey(id), () => getIncident(id), options);
export const useGetIncidentOverview = (id: number, options?: QueryOptions) => query(getGetIncidentOverviewQueryKey(id), () => getIncidentOverview(id), options);
export const useListEvacuationCenters = (params?: { incidentId?: number; search?: string }, options?: QueryOptions) => query(getListEvacuationCentersQueryKey(params), () => listEvacuationCenters(params), options);
export const useListStructureDamages = (params?: { incidentId?: number }, options?: QueryOptions) => query(getListStructureDamagesQueryKey(params), () => listStructureDamages(params), options);
export const useListUsers = (options?: QueryOptions) => query(getListUsersQueryKey(), listUsers, options);
const mutation = <TVariables, TData>(fn: (variables: TVariables) => Promise<TData>): UseMutationResult<TData, Error, TVariables> => useMutation({ mutationFn: fn });
export const useCreateIncident = () => mutation<{ data: IncidentInput }, Incident>(value => createIncident(value.data));
export const useUpdateIncident = () => mutation<{ id: number; data: IncidentInput }, Incident | undefined>(value => updateIncident(value.id, value.data));
export const useDeleteIncident = () => mutation<{ id: number }, boolean>(value => deleteIncident(value.id));
export const useCreateEvacuationCenter = () => mutation<{ data: EvacuationCenterInput }, EvacuationCenter>(value => createEvacuationCenter(value.data));
export const useUpdateEvacuationCenter = () => mutation<{ id: number; data: EvacuationCenterInput }, EvacuationCenter | undefined>(value => updateEvacuationCenter(value.id, value.data));
export const useDeleteEvacuationCenter = () => mutation<{ id: number }, EvacuationCenter | undefined>(value => deleteEvacuationCenter(value.id));
export const useCreateStructureDamage = () => mutation<{ data: StructureDamageInput }, StructureDamage>(value => createStructureDamage(value.data));
export const useUpdateStructureDamage = () => mutation<{ id: number; data: StructureDamageInput }, StructureDamage | undefined>(value => updateStructureDamage(value.id, value.data));
export const useDeleteStructureDamage = () => mutation<{ id: number }, StructureDamage | undefined>(value => deleteStructureDamage(value.id));
export const useGenerateSituationalReport = () => mutation<{ data: SituationalReportInput }, SituationalReport>(value => generateSituationalReport(value.data));
export const useTransferEvacuees = () => mutation<{ incidentId: number; sourceCenterId: number; destinationCenterId: number; count: number }, void>(transferEvacuees);
