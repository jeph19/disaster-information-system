import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { firestore } from './firebase';

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
}
export interface IncidentInput {
  title: string; incidentType: IncidentType; status: IncidentStatus; severity: Severity; location: string;
  startedAt: string; summary: string; affectedPopulation?: number; evacuatedPopulation?: number;
  deaths?: number; injuries?: number; missing?: number;
}
export interface EvacuationCenter {
  id: number; incidentId: number; name: string; barangay: string; address: string; capacity: number;
  currentPopulation: number; families: number; men: number; women: number; children: number; seniors: number;
  pwd: number; status: EvacuationCenterStatus; contactPerson: string; contactNumber: string; updatedAt: string;
}
export interface EvacuationCenterInput {
  incidentId: number; name: string; barangay: string; address: string; capacity: number; currentPopulation: number;
  families: number; men: number; women: number; children: number; seniors: number; pwd: number;
  status: EvacuationCenterStatus; contactPerson: string; contactNumber: string;
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
}
export interface DashboardSummary {
  activeIncidents: number; totalIncidents: number; totalEvacuationCenters: number; totalEvacuated: number;
  totalCapacity: number; totalFamilies: number; partiallyDamaged: number; totallyDamaged: number;
  populationByIncident: { incidentId: number; label: string; population: number }[]; recentIncidents: Incident[];
}
export interface SituationalReportInput {
  incidentId: number; reportDate: string; preparedBy: string; operationalSummary: string;
  priorityNeeds: string; actionsTaken: string; nextSteps: string;
}
export interface SituationalReport {
  reportNumber: string; generatedAt: string; reportDate: string; preparedBy: string; incident: Incident;
  centers: EvacuationCenter[]; damages: StructureDamage[]; operationalSummary: string; priorityNeeds: string;
  actionsTaken: string; nextSteps: string;
}
export type UserRole = 'Administrator' | 'Coordinator' | 'Viewer';
export interface FirestoreUser { id: string; name: string; email: string; role: UserRole; status: 'Active' | 'Disabled'; createdAt: string; }

const names = {
  incidents: 'disaster_incidents',
  centers: 'disaster_evacuation_centers',
  damages: 'disaster_structure_damages',
  users: 'disaster_users',
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

async function records<T>(name: string): Promise<T[]> {
  const snapshot = await getDocs(collection(firestore, name));
  return snapshot.docs.map(item => {
    const data = item.data() as Record<string, unknown>;
    for (const field of ['startedAt', 'updatedAt', 'createdAt', 'generatedAt', 'reportDate']) {
      if (field in data) data[field] = asIso(data[field]);
    }
    return data as T;
  });
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
      const existing = await records<Incident>(names.incidents);
      if (existing.length) return;
      await Promise.all(seedIncidents.map(item => putRecord(names.incidents, item.id, { ...item, startedAt: dateValue(item.startedAt), updatedAt: dateValue(item.updatedAt) })));
      await Promise.all(seedCenters.map(item => putRecord(names.centers, item.id, { ...item, updatedAt: dateValue(item.updatedAt) })));
      await Promise.all(seedDamages.map(item => putRecord(names.damages, item.id, { ...item, updatedAt: dateValue(item.updatedAt) })));
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
  await putRecord(names.incidents, id, { ...item, startedAt: dateValue(item.startedAt), updatedAt: now }); return item;
}
export async function updateIncident(id: number, input: IncidentInput): Promise<Incident | undefined> {
  const previous = await getIncident(id); if (!previous) return undefined;
  const item = { ...previous, ...input, id, updatedAt: new Date().toISOString() };
  await putRecord(names.incidents, id, { ...item, startedAt: dateValue(item.startedAt), updatedAt: dateValue(item.updatedAt) }); return item;
}
export async function deleteIncident(id: number): Promise<boolean> {
  const previous = await getIncident(id); if (!previous) return false;
  const [centers, damages] = await Promise.all([records<EvacuationCenter>(names.centers), records<StructureDamage>(names.damages)]);
  await Promise.all([...centers.filter(item => item.incidentId === id).map(item => deleteDoc(doc(firestore, names.centers, String(item.id)))), ...damages.filter(item => item.incidentId === id).map(item => deleteDoc(doc(firestore, names.damages, String(item.id)))), deleteDoc(doc(firestore, names.incidents, String(id)))]);
  return true;
}
export async function listEvacuationCenters(params?: { incidentId?: number; search?: string }): Promise<EvacuationCenter[]> {
  await ensureSeedData(); return (await records<EvacuationCenter>(names.centers)).filter(item => (params?.incidentId === undefined || item.incidentId === params.incidentId) && (!params?.search || item.barangay === params.search)).sort((a, b) => b.currentPopulation - a.currentPopulation);
}
export async function createEvacuationCenter(input: EvacuationCenterInput): Promise<EvacuationCenter> {
  await ensureSeedData();
  const item = { ...input, id: await nextId(names.centers), updatedAt: new Date().toISOString() }; await putRecord(names.centers, item.id, { ...item, updatedAt: new Date(item.updatedAt) }); return item;
}
export async function updateEvacuationCenter(id: number, input: EvacuationCenterInput): Promise<EvacuationCenter | undefined> {
  const previous = (await listEvacuationCenters()).find(item => item.id === id); if (!previous) return undefined;
  const item = { ...previous, ...input, id, updatedAt: new Date().toISOString() }; await putRecord(names.centers, id, { ...item, updatedAt: new Date(item.updatedAt) }); return item;
}
export async function deleteEvacuationCenter(id: number): Promise<EvacuationCenter | undefined> {
  const item = (await listEvacuationCenters()).find(record => record.id === id); if (!item) return undefined; await deleteDoc(doc(firestore, names.centers, String(id))); return item;
}
export async function listStructureDamages(params?: { incidentId?: number }): Promise<StructureDamage[]> {
  await ensureSeedData(); return (await records<StructureDamage>(names.damages)).filter(item => params?.incidentId === undefined || item.incidentId === params.incidentId).sort((a, b) => b.totallyDamaged - a.totallyDamaged);
}
export async function createStructureDamage(input: StructureDamageInput): Promise<StructureDamage> {
  await ensureSeedData();
  const item = { ...input, id: await nextId(names.damages), updatedAt: new Date().toISOString() }; await putRecord(names.damages, item.id, { ...item, updatedAt: new Date(item.updatedAt) }); return item;
}
export async function updateStructureDamage(id: number, input: StructureDamageInput): Promise<StructureDamage | undefined> {
  const previous = (await listStructureDamages()).find(item => item.id === id); if (!previous) return undefined;
  const item = { ...previous, ...input, id, updatedAt: new Date().toISOString() }; await putRecord(names.damages, id, { ...item, updatedAt: new Date(item.updatedAt) }); return item;
}
export async function deleteStructureDamage(id: number): Promise<StructureDamage | undefined> {
  const item = (await listStructureDamages()).find(record => record.id === id); if (!item) return undefined; await deleteDoc(doc(firestore, names.damages, String(id))); return item;
}
export async function getIncidentOverview(id: number): Promise<IncidentOverview | undefined> {
  const incident = await getIncident(id); if (!incident) return undefined;
  const [centers, damages] = await Promise.all([listEvacuationCenters({ incidentId: id }), listStructureDamages({ incidentId: id })]);
  return { incident, centers, damages, totalCenters: centers.length, totalEvacuated: centers.reduce((sum, item) => sum + item.currentPopulation, 0), totalCapacity: centers.reduce((sum, item) => sum + item.capacity, 0), totalFamilies: centers.reduce((sum, item) => sum + item.families, 0), totalPartiallyDamaged: damages.reduce((sum, item) => sum + item.partiallyDamaged, 0), totalTotallyDamaged: damages.reduce((sum, item) => sum + item.totallyDamaged, 0) };
}
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [incidents, centers, damages] = await Promise.all([listIncidents(), listEvacuationCenters(), listStructureDamages()]);
  return { activeIncidents: incidents.filter(item => item.status === 'Active').length, totalIncidents: incidents.length, totalEvacuationCenters: centers.length, totalEvacuated: centers.reduce((sum, item) => sum + item.currentPopulation, 0), totalCapacity: centers.reduce((sum, item) => sum + item.capacity, 0), totalFamilies: centers.reduce((sum, item) => sum + item.families, 0), partiallyDamaged: damages.reduce((sum, item) => sum + item.partiallyDamaged, 0), totallyDamaged: damages.reduce((sum, item) => sum + item.totallyDamaged, 0), populationByIncident: incidents.map(item => ({ incidentId: item.id, label: item.title, population: centers.filter(center => center.incidentId === item.id).reduce((sum, center) => sum + center.currentPopulation, 0) })), recentIncidents: incidents.slice(0, 4) };
}
export async function generateSituationalReport(input: SituationalReportInput): Promise<SituationalReport> {
  const incident = await getIncident(input.incidentId); if (!incident) throw new Error('Incident not found');
  const [centers, damages] = await Promise.all([listEvacuationCenters({ incidentId: input.incidentId }), listStructureDamages({ incidentId: input.incidentId })]);
  return { ...input, reportNumber: `SITREP-${new Date().getFullYear()}-${String(input.incidentId).padStart(3, '0')}`, generatedAt: new Date().toISOString(), incident, centers, damages };
}
export async function upsertUser(user: FirestoreUser): Promise<void> { await setDoc(doc(firestore, names.users, user.id), { ...user, createdAt: dateValue(user.createdAt) }, { merge: true }); }
export async function updateUserRole(id: string, role: UserRole): Promise<void> { await setDoc(doc(firestore, names.users, id), { role }, { merge: true }); }
export async function listUsers(): Promise<FirestoreUser[]> {
  return records<FirestoreUser>(names.users);
}
export async function getUser(id: string): Promise<FirestoreUser | undefined> {
  return (await listUsers()).find(user => user.id === id);
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
