import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  Home,
  LoaderCircle,
  MapPin,
  Menu,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  Trash2,
  Users,
  UserRoundCog,
  X,
} from 'lucide-react';
import {
  EvacuationCenterStatus,
  IncidentStatus,
  IncidentType,
  Severity,
  StructureType,
  getGetDashboardSummaryQueryKey,
  getGetIncidentOverviewQueryKey,
  getGetIncidentQueryKey,
  getListEvacuationCentersQueryKey,
  getListIncidentsQueryKey,
  getListStructureDamagesQueryKey,
  useCreateEvacuationCenter,
  useCreateIncident,
  useCreateStructureDamage,
  useDeleteEvacuationCenter,
  useDeleteIncident,
  useDeleteStructureDamage,
  useGenerateSituationalReport,
  useGetDashboardSummary,
  useGetIncident,
  useGetIncidentOverview,
  useHealthCheck,
  useListEvacuationCenters,
  useListIncidents,
  useListStructureDamages,
  useListUsers,
  useUpdateEvacuationCenter,
  useUpdateIncident,
  useUpdateStructureDamage,
  updateUserRole,
  upsertUser,
  getUser,
  getOrganizationProfile as getCloudOrganizationProfile,
  saveOrganizationProfile,
  type UserRole,
  type EvacuationCenter,
  type EvacuationCenterInput,
  type AgeSexBreakdown,
  type SectorBreakdown,
  type DashboardSummary,
  type Incident,
  type IncidentInput,
  type IncidentOverview,
  type SituationalReport,
  type StructureDamage,
  type StructureDamageInput,
} from '@/lib/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, createUserWithEmailAndPassword, updateProfile, type User as FirebaseUser } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

type LocalRole = 'Administrator' | 'Coordinator' | 'Viewer';
type LocalUser = {
  id: string;
  name: string;
  email: string;
  role: LocalRole;
  createdAt: string;
};

const ageGroups = [
  ['0_6_months', '0–6 months'],
  ['7_months_2_years', '7 months–2 years'],
  ['3_5_years', '3–5 years'],
  ['6_12_years', '6–12 years'],
  ['13_17_years', '13–17 years'],
  ['18_59_years', '18–59 years'],
  ['60_plus_years', '60 years and above'],
] as const;
const sectorGroups = [
  ['pwd', 'PWD'],
  ['four_ps', '4Ps beneficiaries'],
  ['solo_parent', 'Solo parents'],
  ['pregnant', 'Pregnant'],
  ['lactating', 'Lactating'],
] as const;
const emptyBreakdown = (groups: readonly (readonly [string, string])[]) =>
  Object.fromEntries(groups.map(([key]) => [key, { male: 0, female: 0 }]));

type OrganizationProfile = {
  municipality: string;
  desk: string;
  officer: string;
  email: string;
  timezone: string;
};

const defaultOrganizationProfile: OrganizationProfile = {
  municipality: 'Noveleta',
  desk: 'Local Disaster Risk Reduction and Management Office EOC',
  officer: 'Mara Alvarez',
  email: 'eoc@noveleta.gov.ph',
  timezone: 'Asia/Manila',
};
const organizationProfileKey = 'sentinel-organization-profile';
const getLocalOrganizationProfile = (): OrganizationProfile => {
  try {
    const stored = window.localStorage.getItem(organizationProfileKey);
    return stored ? { ...defaultOrganizationProfile, ...JSON.parse(stored) } : defaultOrganizationProfile;
  } catch {
    return defaultOrganizationProfile;
  }
};

const dateLabel = (value?: string) => value ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '—';
const timeLabel = (value?: string) => value ? new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '—';
const number = (value?: number) => new Intl.NumberFormat('en-US').format(value ?? 0);
const money = (value?: number) => `₱${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value ?? 0)}`;
const slug = (value: string) => value.toLowerCase().replaceAll(' ', '-');

function StatusTag({ value, kind = 'status' }: { value: string; kind?: 'status' | 'severity' }) {
  const className = kind === 'severity' ? `tag tag-${slug(value)}` : `tag tag-${slug(value)}`;
  return <span className={className} data-testid={`status-${slug(value)}`}>{value}</span>;
}

function LoadingPanel({ rows = 3 }: { rows?: number }) {
  return <div className="panel panel-body" data-testid="loading-panel">
    <div className="skeleton" style={{ height: 14, width: '30%', marginBottom: 18 }} />
    {Array.from({ length: rows }).map((_, index) => <div className="skeleton" key={index} style={{ height: 40, width: `${88 - index * 9}%`, marginBottom: 10 }} />)}
  </div>;
}

function ErrorPanel({ onRetry, message = 'The operations feed could not be loaded.' }: { onRetry: () => void; message?: string }) {
  return <div className="error-state" data-testid="error-state">
    <AlertTriangle size={18} />
    <div style={{ flex: 1 }}><strong>Connection interrupted.</strong><div style={{ marginTop: 3 }}>{message}</div></div>
    <button className="btn btn-quiet" onClick={onRetry} data-testid="button-retry"><RefreshCw size={13} /> Retry</button>
  </div>;
}

function EmptyPanel({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <div className="empty-state" data-testid="empty-state">
    <div className="empty-icon"><ClipboardCheck size={21} /></div>
    <div className="empty-title">{title}</div>
    <div className="empty-copy">{copy}</div>
    {action}
  </div>;
}

function Shell({ children, user, onSignOut }: { children: ReactNode; user: LocalUser; onSignOut: () => void }) {
  const [location] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const nav = [
    { href: '/', label: 'Command overview', icon: Home },
    { href: '/incidents', label: 'Incident register', icon: Radio },
    { href: '/reports', label: 'Situation reports', icon: FileText },
    { href: '/users', label: 'User management', icon: UserRoundCog },
  ];
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="flex items-center gap-3 no-underline" data-testid="link-brand">
        <div className="brand-mark">/\/</div><div><div className="brand-title">sentinel</div><div className="brand-subtitle">Noveleta EOC</div></div>
      </Link>
      <div className="nav-section">
        <div className="nav-label">Operations desk</div>
        {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-item ${location === href || (href !== '/' && location.startsWith(href)) ? 'active' : ''}`} data-testid={`link-${slug(label)}`}><Icon size={16} strokeWidth={1.8} /><span>{label}</span>{href === '/' && <span className="online-dot" style={{ marginLeft: 'auto' }} />}</Link>)}
      </div>
       <div className="nav-section" style={{ marginTop: 26 }}>
        <div className="nav-label">Workspace</div>
        <Link href="/settings" className={`nav-item ${location.startsWith('/settings') ? 'active' : ''}`} data-testid="link-settings"><Settings2 size={16} strokeWidth={1.8} /><span>Settings</span></Link>
      </div>
       <div className="sidebar-footer"><div className="operator"><div className="operator-avatar">{user.name[0].toUpperCase()}</div><div style={{ minWidth: 0 }}><div className="operator-name">{user.name}</div><div className="operator-role">{user.role}</div></div></div><button className="btn btn-quiet" style={{ width: '100%', marginTop: 14, color: '#c5d9d0', borderColor: 'rgba(223,243,232,.2)' }} onClick={onSignOut} data-testid="button-sign-out">Sign out</button></div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <button className="icon-btn mobile-menu" onClick={() => setMobileNav(!mobileNav)} data-testid="button-mobile-menu"><Menu size={18} /></button>
        <div><div className="topbar-kicker">MUNICIPALITY OF NOVELETA / LOCAL DISASTER RISK REDUCTION AND MANAGEMENT OFFICE EOC</div><div className="topbar-title">Response coordination workspace</div></div>
        <div className="flex items-center gap-3"><span className="online-dot" /><span className="panel-meta">Live sync · 14:32</span></div>
      </header>
       {mobileNav && <div style={{ position: 'fixed', inset: '66px 0 auto 0', zIndex: 20, background: '#173b3b', padding: 12 }}><div className="nav-label">Navigate</div>{nav.concat([{ href: '/settings', label: 'Settings', icon: Settings2 }]).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="nav-item" onClick={() => setMobileNav(false)} data-testid={`mobile-link-${slug(label)}`}><Icon size={16} />{label}</Link>)}</div>}
      {children}
    </main>
  </div>;
}

function Metric({ label, value, foot, tint }: { label: string; value: string | number; foot: string; tint?: string }) {
  return <div className="panel metric-card" style={{ '--metric-tint': tint } as CSSProperties} data-testid={`metric-${slug(label)}`}>
    <div className="metric-label">{label}</div><div className="metric-value">{typeof value === 'number' ? number(value) : value}</div><div className="metric-foot">{foot}</div>
  </div>;
}

function Dashboard() {
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey(), refetchInterval: 60000 } });
  const health = useHealthCheck({ query: { queryKey: ['health'] as const, refetchInterval: 60000 } });
  const summary = summaryQuery.data;
  const bars = summary?.populationByIncident?.map(item => item.population) ?? [34, 56, 41, 72, 48, 64, 52];
  return <div className="content">
    <div className="page-head"><div><div className="eyebrow">Live operational picture</div><h1 className="page-title">Command overview</h1><div className="page-desc">A clear read on people, places, and priorities across Noveleta. Last synchronized from field desks just now.</div></div><Link href="/incidents" className="btn btn-primary" data-testid="link-open-register"><Radio size={15} /> Open incident register</Link></div>
    {summaryQuery.isLoading ? <><div className="metric-grid">{[1,2,3,4].map(x => <div className="panel metric-card skeleton" key={x} />)}</div><LoadingPanel /></> : summaryQuery.isError ? <ErrorPanel onRetry={() => summaryQuery.refetch()} /> : summary ? <DashboardData summary={summary} bars={bars} healthOk={health.data?.status === 'ok' || health.isSuccess} /> : <EmptyPanel title="No operational picture yet" copy="Once incidents are registered, the command overview will populate here." action={<Link href="/incidents" className="btn btn-primary" data-testid="link-create-first-incident"><Plus size={14} /> Register an incident</Link>} />}
  </div>;
}

function DashboardData({ summary, bars, healthOk }: { summary: DashboardSummary; bars: number[]; healthOk: boolean }) {
  const max = Math.max(...bars, 1);
  const recentIncidents = summary.recentIncidents ?? [];
  const populationByIncident = summary.populationByIncident ?? [];
  return <><div className="metric-grid">
    <Metric label="Active incidents" value={summary.activeIncidents ?? 0} foot={`${summary.totalIncidents ?? 0} total in register`} tint="#f5e3c3" />
    <Metric label="Individuals evacuated" value={summary.totalEvacuated ?? 0} foot={`of ${number(summary.totalCapacity)} available capacity`} tint="#d6e8e0" />
    <Metric label="Evacuation centers" value={summary.totalEvacuationCenters ?? 0} foot={`${number(summary.totalFamilies)} families registered`} tint="#dbe7ee" />
    <Metric label="Structures impacted" value={(summary.partiallyDamaged ?? 0) + (summary.totallyDamaged ?? 0)} foot={`${number(summary.totallyDamaged)} totally damaged`} tint="#f3d8d1" />
  </div><div className="dashboard-grid">
    <section className="panel"><div className="panel-header"><div><div className="panel-title">Active incident register</div><div className="panel-meta">{summary.activeIncidents ?? 0} requiring coordination</div></div><Link href="/incidents" className="icon-btn" data-testid="link-dashboard-incidents"><ChevronRight size={16} /></Link></div>{recentIncidents.length ? recentIncidents.slice(0, 5).map(incident => <IncidentRow key={incident.id} incident={incident} />) : <EmptyPanel title="No recent incidents" copy="The desk is clear. New incidents will appear here as they are registered." />}</section>
    <section className="panel panel-body"><div className="chart-note"><div><div className="panel-title">Human impact by incident</div><div className="chart-sub">Affected individuals · current register</div></div><BarChart3 size={18} color="#367c74" /></div><div className="chart-value">{number(populationByIncident.reduce((sum, item) => sum + item.population, 0))}<span className="chart-sub"> individuals</span></div><div className="sparkline" data-testid="chart-population">{bars.map((bar, i) => <div className="spark-bar" key={i} style={{ height: `${Math.max(10, (bar / max) * 100)}%` }} title={populationByIncident[i]?.label ?? 'Incident'} />)}</div><div className="flex justify-between" style={{ color: '#8a9791', fontSize: 10, marginTop: 9 }}><span>Older</span><span>Most recent</span></div><div style={{ borderTop: '1px solid #e9e4d9', marginTop: 22, paddingTop: 17, display:'flex', gap:9, alignItems:'center' }}><Shield size={15} color="#c28b2b" /><span style={{ fontSize: 11, color:'#687775' }}>{healthOk ? 'All systems operational' : 'Checking service health'}</span></div></section>
  </div></>;
}

function IncidentRow({ incident }: { incident: Incident }) {
  return <Link href={`/incidents/${incident.id}`} className="incident-row no-underline" data-testid={`row-incident-${incident.id}`}><div className="code">{incident.code}</div><div><div className="incident-name">{incident.title}</div><div className="incident-location"><MapPin size={10} style={{ display:'inline', marginRight:3 }} />{incident.location}</div></div><StatusTag value={incident.severity} kind="severity" /><div className="text-right"><div style={{ fontSize: 12, color:'#41635e', fontWeight:700 }}>{number(incident.affectedPopulation)}</div><div style={{ fontSize: 10, color:'#8d9993', marginTop:2 }}>affected</div></div></Link>;
}

function IncidentsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [drawer, setDrawer] = useState<Incident | 'new' | null>(null);
  const listQuery = useListIncidents({ search: search || undefined, status: status ? status as typeof IncidentStatus[keyof typeof IncidentStatus] : undefined }, { query: { queryKey: getListIncidentsQueryKey({ search: search || undefined, status: status ? status as typeof IncidentStatus[keyof typeof IncidentStatus] : undefined }) } });
  const create = useCreateIncident();
  const update = useUpdateIncident();
  const remove = useDeleteIncident();
  const queryClient = useQueryClient();
  const incidents = listQuery.data ?? [];
  const save = (payload: IncidentInput, edit?: Incident) => {
    if (edit) update.mutate({ id: edit.id, data: payload }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey() }); setDrawer(null); } });
    else create.mutate({ data: payload }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey() }); setDrawer(null); } });
  };
  const deleteIncident = (id: number) => { if (window.confirm('Remove this incident from the register?')) remove.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey() }) }); };
  return <div className="content"><div className="page-head"><div><div className="eyebrow">Register / Field updates</div><h1 className="page-title">Incident register</h1><div className="page-desc">Search active and historical records, open a live incident picture, or add a report from the field.</div></div><button className="btn btn-primary" onClick={() => setDrawer('new')} data-testid="button-create-incident"><Plus size={15} /> Register incident</button></div>
    <div className="toolbar"><div className="searchbar"><Search size={15} /><input type="search" placeholder="Search code, title, location…" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-incidents" /></div><div className="flex items-center gap-2"><select className="select" value={status} onChange={e => setStatus(e.target.value)} data-testid="select-incident-status"><option value="">All statuses</option><option value="Active">Active</option><option value="Monitoring">Monitoring</option><option value="Closed">Closed</option></select><button className="icon-btn" onClick={() => listQuery.refetch()} data-testid="button-refresh-incidents"><RefreshCw size={15} /></button></div></div>
    {listQuery.isLoading ? <LoadingPanel rows={5} /> : listQuery.isError ? <ErrorPanel onRetry={() => listQuery.refetch()} /> : <section className="panel table-wrap">{incidents.length ? <table className="data-table"><thead><tr><th>Code</th><th>Incident</th><th>Status</th><th>Severity</th><th>Individuals affected</th><th>Updated</th><th /></tr></thead><tbody>{incidents.map(incident => <tr key={incident.id} data-testid={`row-register-${incident.id}`}><td><span className="code">{incident.code}</span></td><td><Link href={`/incidents/${incident.id}`} className="no-underline"><div className="incident-name">{incident.title}</div><div className="incident-location">{incident.location}</div></Link></td><td><StatusTag value={incident.status} /></td><td><StatusTag value={incident.severity} kind="severity" /></td><td><strong style={{ color:'#355b56' }}>{number(incident.affectedPopulation)}</strong></td><td><span className="panel-meta">{dateLabel(incident.updatedAt)}</span></td><td><div className="flex justify-end gap-1"><button className="icon-btn" onClick={() => setDrawer(incident)} title="Edit incident" data-testid={`button-edit-incident-${incident.id}`}><Pencil size={14} /></button><button className="icon-btn" onClick={() => deleteIncident(incident.id)} title="Delete incident" data-testid={`button-delete-incident-${incident.id}`}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table> : <EmptyPanel title="No incidents match" copy="Try a different search or register a new incident to begin the operational record." action={<button className="btn btn-secondary" onClick={() => setDrawer('new')} data-testid="button-empty-create-incident"><Plus size={14} /> Register incident</button>} />}</section>}
    {drawer && <IncidentDrawer value={drawer} onClose={() => setDrawer(null)} onSave={save} pending={create.isPending || update.isPending} />}
  </div>;
}

function IncidentDrawer({ value, onClose, onSave, pending }: { value: Incident | 'new'; onClose: () => void; onSave: (payload: IncidentInput, edit?: Incident) => void; pending: boolean }) {
  const edit = value === 'new' ? undefined : value;
  const [form, setForm] = useState<IncidentInput>({ title: edit?.title ?? '', incidentType: edit?.incidentType ?? IncidentType.Typhoon, status: edit?.status ?? IncidentStatus.Active, severity: edit?.severity ?? Severity.Moderate, location: edit?.location ?? '', startedAt: edit?.startedAt?.slice(0, 16) ?? new Date().toISOString().slice(0, 16), summary: edit?.summary ?? '', affectedPopulation: edit?.affectedPopulation ?? 0, evacuatedPopulation: edit?.evacuatedPopulation ?? 0, deaths: edit?.deaths ?? 0, injuries: edit?.injuries ?? 0, missing: edit?.missing ?? 0 });
  const set = (key: keyof IncidentInput, value: string | number) => setForm(current => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => { event.preventDefault(); if (!form.title.trim() || !form.location.trim()) return; onSave({ ...form, affectedPopulation: Number(form.affectedPopulation), evacuatedPopulation: Number(form.evacuatedPopulation), deaths: Number(form.deaths), injuries: Number(form.injuries), missing: Number(form.missing) }, edit); };
  return <div className="drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}><aside className="drawer"><div className="drawer-head"><div><div className="eyebrow">{edit ? 'Update record' : 'New record'}</div><div className="page-title" style={{ fontSize: 25, marginTop: 7 }}>{edit ? 'Edit incident' : 'Register incident'}</div></div><button className="icon-btn" onClick={onClose} data-testid="button-close-incident-drawer"><X size={18} /></button></div><form className="drawer-content" onSubmit={submit}><div className="form-grid">
    <Field label="Title" full><input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Typhoon Pilar" required data-testid="input-incident-title" /></Field>
    <Field label="Incident type"><select value={form.incidentType} onChange={e => set('incidentType', e.target.value)} data-testid="select-incident-type">{Object.values(IncidentType).map(item => <option key={item} value={item}>{item}</option>)}</select></Field>
    <Field label="Severity"><select value={form.severity} onChange={e => set('severity', e.target.value)} data-testid="select-incident-severity">{Object.values(Severity).map(item => <option key={item} value={item}>{item}</option>)}</select></Field>
    <Field label="Status"><select value={form.status} onChange={e => set('status', e.target.value)} data-testid="select-incident-status-form">{Object.values(IncidentStatus).map(item => <option key={item} value={item}>{item}</option>)}</select></Field>
    <Field label="Started at"><input type="datetime-local" value={form.startedAt} onChange={e => set('startedAt', e.target.value)} required data-testid="input-incident-started" /></Field>
    <Field label="Location" full><input value={form.location} onChange={e => set('location', e.target.value)} placeholder="Barangay or affected area" required data-testid="input-incident-location" /></Field>
    <Field label="Operational summary" full><textarea value={form.summary} onChange={e => set('summary', e.target.value)} placeholder="What is happening on the ground?" data-testid="input-incident-summary" /></Field>
    <Field label="Affected individuals"><input type="number" min="0" value={form.affectedPopulation} onChange={e => set('affectedPopulation', e.target.value)} data-testid="input-affected-population" /></Field>
    <Field label="Evacuated individuals"><input type="number" min="0" value={form.evacuatedPopulation} onChange={e => set('evacuatedPopulation', e.target.value)} data-testid="input-evacuated-population" /></Field>
    <Field label="Deaths"><input type="number" min="0" value={form.deaths} onChange={e => set('deaths', e.target.value)} data-testid="input-deaths" /></Field><Field label="Injuries"><input type="number" min="0" value={form.injuries} onChange={e => set('injuries', e.target.value)} data-testid="input-injuries" /></Field><Field label="Missing"><input type="number" min="0" value={form.missing} onChange={e => set('missing', e.target.value)} data-testid="input-missing" /></Field>
  </div><div className="flex justify-end gap-2" style={{ marginTop: 24 }}><button type="button" className="btn btn-quiet" onClick={onClose} data-testid="button-cancel-incident">Cancel</button><button type="submit" className="btn btn-primary" disabled={pending} data-testid="button-save-incident">{pending ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}{edit ? 'Save changes' : 'Create record'}</button></div></form></aside></div>;
}

function Field({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) { return <div className={`field ${full ? 'full' : ''}`}><label>{label}</label>{children}</div>; }

function IncidentDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const overviewQuery = useGetIncidentOverview(id, { query: { queryKey: getGetIncidentOverviewQueryKey(id), refetchInterval: 30000 } });
  const incidentQuery = useGetIncident(id, { query: { queryKey: getGetIncidentQueryKey(id), enabled: !overviewQuery.data } });
  const centersQuery = useListEvacuationCenters({ incidentId: id }, { query: { queryKey: getListEvacuationCentersQueryKey({ incidentId: id }) } });
  const damagesQuery = useListStructureDamages({ incidentId: id }, { query: { queryKey: getListStructureDamagesQueryKey({ incidentId: id }) } });
  const createCenter = useCreateEvacuationCenter(); const updateCenter = useUpdateEvacuationCenter(); const deleteCenter = useDeleteEvacuationCenter();
  const createDamage = useCreateStructureDamage(); const updateDamage = useUpdateStructureDamage(); const deleteDamage = useDeleteStructureDamage();
  const queryClient = useQueryClient();
  const [centerDrawer, setCenterDrawer] = useState<EvacuationCenter | 'new' | null>(null);
  const [damageDrawer, setDamageDrawer] = useState<StructureDamage | 'new' | null>(null);
  const incident = overviewQuery.data?.incident ?? incidentQuery.data;
  const overview = overviewQuery.data;
  const centers = overview?.centers ?? centersQuery.data ?? [];
  const damages = overview?.damages ?? damagesQuery.data ?? [];
  const refresh = () => { overviewQuery.refetch(); centersQuery.refetch(); damagesQuery.refetch(); };
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: getGetIncidentOverviewQueryKey(id) }); queryClient.invalidateQueries({ queryKey: getListEvacuationCentersQueryKey({ incidentId: id }) }); queryClient.invalidateQueries({ queryKey: getListStructureDamagesQueryKey({ incidentId: id }) }); };
  if (overviewQuery.isLoading && !incident) return <div className="content"><LoadingPanel rows={6} /></div>;
  if (overviewQuery.isError || !incident) return <div className="content"><Link href="/incidents" className="btn btn-quiet" data-testid="link-back-incidents"><ArrowLeft size={14} /> Back to register</Link><div style={{ marginTop: 18 }}><ErrorPanel onRetry={refresh} message="This incident may have been removed or is temporarily unavailable." /></div></div>;
  const totals = { centers: overview?.totalCenters ?? centers.length, evacuated: overview?.totalEvacuated ?? centers.reduce((a, c) => a + c.currentPopulation, 0), capacity: overview?.totalCapacity ?? centers.reduce((a, c) => a + c.capacity, 0), families: overview?.totalFamilies ?? centers.reduce((a, c) => a + c.families, 0), partial: overview?.totalPartiallyDamaged ?? damages.reduce((a, d) => a + d.partiallyDamaged, 0), total: overview?.totalTotallyDamaged ?? damages.reduce((a, d) => a + d.totallyDamaged, 0) };
  const saveCenter = (payload: EvacuationCenterInput, edit?: EvacuationCenter) => { if (edit) updateCenter.mutate({ id: edit.id, data: payload }, { onSuccess: () => { invalidate(); setCenterDrawer(null); } }); else createCenter.mutate({ data: payload }, { onSuccess: () => { invalidate(); setCenterDrawer(null); } }); };
  const saveDamage = (payload: StructureDamageInput, edit?: StructureDamage) => { if (edit) updateDamage.mutate({ id: edit.id, data: payload }, { onSuccess: () => { invalidate(); setDamageDrawer(null); } }); else createDamage.mutate({ data: payload }, { onSuccess: () => { invalidate(); setDamageDrawer(null); } }); };
  return <div className="content"><div style={{ marginBottom: 18 }}><Link href="/incidents" className="btn btn-quiet" data-testid="link-back-incidents"><ArrowLeft size={14} /> Incident register</Link></div>
    <section className="panel detail-banner"><div><div className="detail-code">{incident.code} · {incident.incidentType}</div><h1 className="detail-title">{incident.title}</h1><div className="detail-summary">{incident.summary || 'No operational summary has been added.'}</div><div className="flex items-center gap-3" style={{ marginTop: 14 }}><StatusTag value={incident.status} /><StatusTag value={incident.severity} kind="severity" /><span className="panel-meta"><MapPin size={12} style={{ display:'inline', marginRight:4 }} />{incident.location}</span><span className="panel-meta"><Clock3 size={12} style={{ display:'inline', marginRight:4 }} />Updated {timeLabel(incident.updatedAt)}</span></div></div><Link href="/reports" className="btn btn-secondary" data-testid="link-detail-report"><FileText size={14} /> Situation report</Link></section>
    <div className="detail-stats"><DetailStat label="Affected individuals" value={incident.affectedPopulation} /><DetailStat label="Evacuated individuals" value={incident.evacuatedPopulation} /><DetailStat label="Evacuation centers" value={totals.centers} /><DetailStat label="Sheltered individuals" value={totals.evacuated} /><DetailStat label="Families sheltered" value={totals.families} /><DetailStat label="Deaths" value={incident.deaths} alert={incident.deaths > 0} /><DetailStat label="Injuries" value={incident.injuries} alert={incident.injuries > 0} /><DetailStat label="Missing" value={incident.missing} alert={incident.missing > 0} /></div>
    <div className="section-stack"><section className="panel"><div className="panel-header"><div><div className="panel-title">Evacuation centers</div><div className="panel-meta">{number(totals.centers)} centers · {number(totals.evacuated)} individuals sheltered · {number(totals.families)} families</div></div><button className="btn btn-secondary" onClick={() => setCenterDrawer('new')} data-testid="button-add-center"><Plus size={14} /> Add center</button></div>{centers.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Center</th><th>Barangay</th><th>Individuals</th><th>Families</th><th>Utilization</th><th>Status</th><th /></tr></thead><tbody>{centers.map(center => <tr key={center.id} data-testid={`row-center-${center.id}`}><td><div className="incident-name">{center.name}</div><div className="incident-location">{center.contactPerson} · {center.contactNumber}</div></td><td>{center.barangay}</td><td><strong style={{ color:'#2d5d57' }}>{number(center.currentPopulation)}</strong> <span className="panel-meta">/ {number(center.capacity)}</span></td><td>{number(center.families)}</td><td><div style={{ height:5, width:75, background:'#e4e6de', borderRadius:4 }}><div style={{ height:'100%', borderRadius:4, background:center.currentPopulation / center.capacity >= .9 ? '#d85d4d' : '#3f988c', width:`${Math.min(100, center.currentPopulation / Math.max(1, center.capacity) * 100)}%` }} /></div></td><td><StatusTag value={center.status} /></td><td><div className="flex gap-1"><button className="icon-btn" onClick={() => setCenterDrawer(center)} data-testid={`button-edit-center-${center.id}`}><Pencil size={13} /></button><button className="icon-btn" onClick={() => { if (window.confirm('Remove this evacuation center?')) deleteCenter.mutate({ id: center.id }, { onSuccess: invalidate }); }} data-testid={`button-delete-center-${center.id}`}><Trash2 size={13} /></button></div></td></tr>)}</tbody></table></div> : <EmptyPanel title="No evacuation centers" copy="Add the first center to start tracking people, families, and available capacity." action={<button className="btn btn-secondary" onClick={() => setCenterDrawer('new')} data-testid="button-empty-add-center"><Plus size={14} /> Add center</button>} />}</section>
      {centers.length > 0 && <section className="panel"><div className="panel-header"><div><div className="panel-title">Age and sex counter-check</div><div className="panel-meta">Mutually exclusive age groups across all evacuation centers</div></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Age group</th><th>Male</th><th>Female</th><th>Total</th></tr></thead><tbody>{ageGroups.map(([key, label]) => { const male = centers.reduce((sum, center) => sum + (center.ageSex?.[key]?.male ?? 0), 0); const female = centers.reduce((sum, center) => sum + (center.ageSex?.[key]?.female ?? 0), 0); return <tr key={key}><td>{label}</td><td>{number(male)}</td><td>{number(female)}</td><td><strong>{number(male + female)}</strong></td></tr>; })}</tbody></table></div></section>}
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Structure damage assessment</div><div className="panel-meta">{number(totals.partial)} partial · {number(totals.total)} total damage records</div></div><button className="btn btn-secondary" onClick={() => setDamageDrawer('new')} data-testid="button-add-damage"><Plus size={14} /> Record damage</button></div>{damages.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Structure</th><th>Location</th><th>Partial</th><th>Total</th><th>Estimated loss</th><th /></tr></thead><tbody>{damages.map(damage => <tr key={damage.id} data-testid={`row-damage-${damage.id}`}><td><div className="incident-name">{damage.structureType}</div><div className="incident-location">{damage.notes || 'No notes'}</div></td><td>{damage.location}</td><td><strong style={{ color:'#b07b27' }}>{number(damage.partiallyDamaged)}</strong></td><td><strong style={{ color:'#b84e43' }}>{number(damage.totallyDamaged)}</strong></td><td>{money(damage.estimatedLoss)}</td><td><div className="flex gap-1"><button className="icon-btn" onClick={() => setDamageDrawer(damage)} data-testid={`button-edit-damage-${damage.id}`}><Pencil size={13} /></button><button className="icon-btn" onClick={() => { if (window.confirm('Remove this damage assessment?')) deleteDamage.mutate({ id: damage.id }, { onSuccess: invalidate }); }} data-testid={`button-delete-damage-${damage.id}`}><Trash2 size={13} /></button></div></td></tr>)}</tbody></table></div> : <EmptyPanel title="No damage assessments" copy="Record affected structures to build the official impact picture." action={<button className="btn btn-secondary" onClick={() => setDamageDrawer('new')} data-testid="button-empty-add-damage"><Plus size={14} /> Record damage</button>} />}</section></div>
    {centerDrawer && <CenterDrawer incidentId={id} value={centerDrawer} onClose={() => setCenterDrawer(null)} onSave={saveCenter} pending={createCenter.isPending || updateCenter.isPending} />}
    {damageDrawer && <DamageDrawer incidentId={id} value={damageDrawer} onClose={() => setDamageDrawer(null)} onSave={saveDamage} pending={createDamage.isPending || updateDamage.isPending} />}
  </div>;
}

function DetailStat({ label, value, alert }: { label: string; value: number; alert?: boolean }) { return <div className="detail-stat"><div className="label">{label}</div><div className="value" style={alert ? { color:'#ba5547' } : undefined}>{number(value)}</div></div>; }

function CenterDrawer({ incidentId, value, onClose, onSave, pending }: { incidentId: number; value: EvacuationCenter | 'new'; onClose: () => void; onSave: (payload: EvacuationCenterInput, edit?: EvacuationCenter) => void; pending: boolean }) {
  const edit = value === 'new' ? undefined : value;
  const [form, setForm] = useState<EvacuationCenterInput>({ incidentId, name: edit?.name ?? '', barangay: edit?.barangay ?? '', address: edit?.address ?? '', capacity: edit?.capacity ?? 100, currentPopulation: edit?.currentPopulation ?? 0, families: edit?.families ?? 0, men: edit?.men ?? 0, women: edit?.women ?? 0, children: edit?.children ?? 0, seniors: edit?.seniors ?? 0, pwd: edit?.pwd ?? 0, ageSex: edit?.ageSex ?? emptyBreakdown(ageGroups), sectors: edit?.sectors ?? emptyBreakdown(sectorGroups), status: edit?.status ?? EvacuationCenterStatus.Open, contactPerson: edit?.contactPerson ?? '', contactNumber: edit?.contactNumber ?? '' });
  const set = (key: keyof EvacuationCenterInput, value: string | number) => setForm(cur => ({ ...cur, [key]: value }));
  const setBreakdown = (kind: 'ageSex' | 'sectors', key: string, gender: 'male' | 'female', value: string) => setForm(cur => ({ ...cur, [kind]: { ...cur[kind], [key]: { ...cur[kind][key], [gender]: Number(value) || 0 } } }));
  const ageTotal = Object.values(form.ageSex).reduce((sum, item) => sum + item.male + item.female, 0);
  const submit = (event: FormEvent) => { event.preventDefault(); onSave({ ...form, incidentId, capacity:Number(form.capacity), currentPopulation:Number(form.currentPopulation), families:Number(form.families), men:Number(form.men), women:Number(form.women), children:Number(form.children), seniors:Number(form.seniors), pwd:Number(form.pwd) }, edit); };
  return <Drawer title={edit ? 'Edit evacuation center' : 'Add evacuation center'} eyebrow="Shelter register" onClose={onClose}><form onSubmit={submit}><div className="form-grid"><Field label="Center name" full><input required value={form.name} onChange={e => set('name',e.target.value)} data-testid="input-center-name" /></Field><Field label="Barangay"><input value={form.barangay} onChange={e => set('barangay',e.target.value)} data-testid="input-center-barangay" /></Field><Field label="Status"><select value={form.status} onChange={e => set('status',e.target.value)} data-testid="select-center-status">{Object.values(EvacuationCenterStatus).map(v => <option key={v}>{v}</option>)}</select></Field><Field label="Address" full><input value={form.address} onChange={e => set('address',e.target.value)} data-testid="input-center-address" /></Field><Field label="Capacity"><input type="number" min="1" value={form.capacity} onChange={e => set('capacity',e.target.value)} data-testid="input-center-capacity" /></Field><Field label="Total evacuees (individuals)"><input type="number" min="0" value={form.currentPopulation} onChange={e => set('currentPopulation',e.target.value)} data-testid="input-center-population" /></Field><Field label="Total families"><input type="number" min="0" value={form.families} onChange={e => set('families',e.target.value)} data-testid="input-center-families" /></Field><Field label="Contact person"><input value={form.contactPerson} onChange={e => set('contactPerson',e.target.value)} data-testid="input-center-contact" /></Field><Field label="Contact number"><input value={form.contactNumber} onChange={e => set('contactNumber',e.target.value)} data-testid="input-center-number" /></Field></div><div className="panel" style={{ marginTop:18, padding:14 }}><div className="panel-title">Age and sex counter-check</div><div className="panel-meta" style={{ marginBottom:10 }}>Enter male and female counts. Total: {number(ageTotal)} / {number(Number(form.currentPopulation))} evacuees {ageTotal === Number(form.currentPopulation) ? '· Matched' : '· Review required'}</div><div className="table-wrap"><table className="data-table"><thead><tr><th>Age group</th><th>Male</th><th>Female</th><th>Total</th></tr></thead><tbody>{ageGroups.map(([key, label]) => <tr key={key}><td>{label}</td><td><input type="number" min="0" value={form.ageSex[key]?.male ?? 0} onChange={e => setBreakdown('ageSex', key, 'male', e.target.value)} /></td><td><input type="number" min="0" value={form.ageSex[key]?.female ?? 0} onChange={e => setBreakdown('ageSex', key, 'female', e.target.value)} /></td><td>{number((form.ageSex[key]?.male ?? 0) + (form.ageSex[key]?.female ?? 0))}</td></tr>)}</tbody></table></div></div><div className="panel" style={{ marginTop:18, padding:14 }}><div className="panel-title">Sector breakdown</div><div className="panel-meta" style={{ marginBottom:10 }}>These classifications may overlap with age groups.</div><div className="table-wrap"><table className="data-table"><thead><tr><th>Category</th><th>Male</th><th>Female</th><th>Total</th></tr></thead><tbody>{sectorGroups.map(([key, label]) => <tr key={key}><td>{label}</td><td><input type="number" min="0" disabled={key === 'pregnant' || key === 'lactating'} value={form.sectors[key]?.male ?? 0} onChange={e => setBreakdown('sectors', key, 'male', e.target.value)} /></td><td><input type="number" min="0" value={form.sectors[key]?.female ?? 0} onChange={e => setBreakdown('sectors', key, 'female', e.target.value)} /></td><td>{number((form.sectors[key]?.male ?? 0) + (form.sectors[key]?.female ?? 0))}</td></tr>)}</tbody></table></div></div><FormActions onClose={onClose} pending={pending} saveLabel={edit ? 'Save center' : 'Add center'} testId="center" /></form></Drawer>;
}

function DamageDrawer({ incidentId, value, onClose, onSave, pending }: { incidentId: number; value: StructureDamage | 'new'; onClose: () => void; onSave: (payload: StructureDamageInput, edit?: StructureDamage) => void; pending: boolean }) {
  const edit = value === 'new' ? undefined : value;
  const [form, setForm] = useState<StructureDamageInput>({ incidentId, structureType: edit?.structureType ?? StructureType.House, location: edit?.location ?? '', partiallyDamaged: edit?.partiallyDamaged ?? 0, totallyDamaged: edit?.totallyDamaged ?? 0, estimatedLoss: edit?.estimatedLoss ?? 0, notes: edit?.notes ?? '' });
  const set = (key: keyof StructureDamageInput, value: string | number) => setForm(cur => ({ ...cur, [key]: value }));
  const submit = (event: FormEvent) => { event.preventDefault(); onSave({ ...form, incidentId, partiallyDamaged:Number(form.partiallyDamaged), totallyDamaged:Number(form.totallyDamaged), estimatedLoss:Number(form.estimatedLoss) }, edit); };
  return <Drawer title={edit ? 'Edit damage assessment' : 'Record structure damage'} eyebrow="Impact assessment" onClose={onClose}><form onSubmit={submit}><div className="form-grid"><Field label="Structure type"><select value={form.structureType} onChange={e => set('structureType',e.target.value)} data-testid="select-damage-type">{Object.values(StructureType).map(v => <option key={v}>{v}</option>)}</select></Field><Field label="Location"><input required value={form.location} onChange={e => set('location',e.target.value)} data-testid="input-damage-location" /></Field><Field label="Partially damaged"><input type="number" min="0" value={form.partiallyDamaged} onChange={e => set('partiallyDamaged',e.target.value)} data-testid="input-damage-partial" /></Field><Field label="Totally damaged"><input type="number" min="0" value={form.totallyDamaged} onChange={e => set('totallyDamaged',e.target.value)} data-testid="input-damage-total" /></Field><Field label="Estimated loss (PHP)"><input type="number" min="0" value={form.estimatedLoss} onChange={e => set('estimatedLoss',e.target.value)} data-testid="input-damage-loss" /></Field><Field label="Notes" full><textarea value={form.notes} onChange={e => set('notes',e.target.value)} data-testid="input-damage-notes" /></Field></div><FormActions onClose={onClose} pending={pending} saveLabel={edit ? 'Save assessment' : 'Record assessment'} testId="damage" /></form></Drawer>;
}

function Drawer({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode }) { return <div className="drawer-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}><aside className="drawer"><div className="drawer-head"><div><div className="eyebrow">{eyebrow}</div><div className="page-title" style={{ fontSize:25, marginTop:7 }}>{title}</div></div><button className="icon-btn" onClick={onClose} data-testid="button-close-drawer"><X size={18} /></button></div><div className="drawer-content">{children}</div></aside></div>; }
function FormActions({ onClose, pending, saveLabel, testId }: { onClose: () => void; pending: boolean; saveLabel: string; testId: string }) { return <div className="flex justify-end gap-2" style={{ marginTop:24 }}><button type="button" className="btn btn-quiet" onClick={onClose} data-testid={`button-cancel-${testId}`}>Cancel</button><button type="submit" className="btn btn-primary" disabled={pending} data-testid={`button-save-${testId}`}>{pending ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}{saveLabel}</button></div>; }

function ReportsPage({ user }: { user: LocalUser }) {
  const incidentsQuery = useListIncidents(undefined, { query: { queryKey: getListIncidentsQueryKey() } });
  const generate = useGenerateSituationalReport();
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState({ reportDate: new Date().toISOString().slice(0,10), preparedBy: user.name, operationalSummary: 'Field desks continue to coordinate evacuation, damage assessment, and essential service restoration.', priorityNeeds: 'Potable water, family hygiene kits, and additional medical support.', actionsTaken: 'Evacuation centers activated. Barangay focal points are submitting rolling headcounts.', nextSteps: 'Validate the next headcount cycle and consolidate outstanding damage assessments.' });
  const [report, setReport] = useState<SituationalReport | null>(null);
  const [organization, setOrganization] = useState<OrganizationProfile>(getLocalOrganizationProfile);
  const incidents = incidentsQuery.data ?? [];
  useEffect(() => { if (!selected && incidents[0]) setSelected(String(incidents[0].id)); }, [incidents, selected]);
  useEffect(() => { setForm(previous => ({ ...previous, preparedBy: user.name })); }, [user.name]);
  useEffect(() => {
    const refreshOrganization = () => {
      void getCloudOrganizationProfile().then(profile => {
        if (profile) setOrganization(profile);
      });
    };
    refreshOrganization();
    window.addEventListener('organization-profile-updated', refreshOrganization);
    window.addEventListener('storage', refreshOrganization);
    return () => {
      window.removeEventListener('organization-profile-updated', refreshOrganization);
      window.removeEventListener('storage', refreshOrganization);
    };
  }, []);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!selected) return; generate.mutate({ data: { incidentId:Number(selected), ...form, preparedBy: user.name } }, { onSuccess: setReport }); };
  return <div className="content"><div className="page-head"><div><div className="eyebrow">Official documentation</div><h1 className="page-title">Situation reports</h1><div className="page-desc">Generate a standard report from the live incident register. The numbers below are assembled from current shelter and damage records.</div></div>{report && <button className="btn btn-secondary" onClick={() => window.print()} data-testid="button-print-report"><FileText size={14} /> Print report</button>}</div>
    {incidentsQuery.isLoading ? <LoadingPanel rows={4} /> : incidentsQuery.isError ? <ErrorPanel onRetry={() => incidentsQuery.refetch()} /> : <div className="report-layout"><section className="panel"><div className="panel-header"><div><div className="panel-title">Report setup</div><div className="panel-meta">Standard SITREP · current data</div></div><FileText size={17} color="#347d74" /></div><form className="panel-body" onSubmit={submit}><div className="form-grid"><Field label="Incident" full><select required value={selected} onChange={e => setSelected(e.target.value)} data-testid="select-report-incident"><option value="">Choose an incident</option>{incidents.map(i => <option key={i.id} value={i.id}>{i.code} · {i.title}</option>)}</select></Field><Field label="Report date"><input type="date" value={form.reportDate} onChange={e => setForm({ ...form, reportDate:e.target.value })} data-testid="input-report-date" /></Field><Field label="Duty officer"><input value={form.preparedBy} readOnly aria-readonly="true" data-testid="input-report-prepared-by" /></Field><Field label="Operational summary" full><textarea value={form.operationalSummary} onChange={e => setForm({ ...form, operationalSummary:e.target.value })} data-testid="input-report-summary" /></Field><Field label="Priority needs" full><textarea value={form.priorityNeeds} onChange={e => setForm({ ...form, priorityNeeds:e.target.value })} data-testid="input-report-needs" /></Field><Field label="Actions taken" full><textarea value={form.actionsTaken} onChange={e => setForm({ ...form, actionsTaken:e.target.value })} data-testid="input-report-actions" /></Field><Field label="Next steps" full><textarea value={form.nextSteps} onChange={e => setForm({ ...form, nextSteps:e.target.value })} data-testid="input-report-next-steps" /></Field></div><button type="submit" className="btn btn-primary" style={{ width:'100%', marginTop:20 }} disabled={generate.isPending || !selected} data-testid="button-generate-report">{generate.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <ClipboardCheck size={14} />}{generate.isPending ? 'Building report…' : 'Generate official report'}</button>{generate.isError && <div style={{ color:'#a2473e', fontSize:11, marginTop:12 }}>Report generation failed. Review the fields and retry.</div>}</form></section>{report ? <ReportPreview report={report} organization={organization} /> : <div className="panel empty-state" style={{ minHeight:600, display:'flex', flexDirection:'column', justifyContent:'center' }}><div className="empty-icon"><FileText size={21} /></div><div className="empty-title">Your report preview will appear here</div><div className="empty-copy">Choose an incident, add the operational narrative, and generate a signed-off situation report.</div></div>}</div>}
  </div>;
}

function ReportPreview({ report, organization }: { report: SituationalReport; organization: OrganizationProfile }) {
  const centerPopulation = report.centers.reduce((sum, c) => sum + c.currentPopulation, 0);
  const partial = report.damages.reduce((sum, d) => sum + d.partiallyDamaged, 0);
  const total = report.damages.reduce((sum, d) => sum + d.totallyDamaged, 0);
  const ageTotals = ageGroups.map(([key, label]) => ({ label, male: report.centers.reduce((sum, center) => sum + (center.ageSex?.[key]?.male ?? 0), 0), female: report.centers.reduce((sum, center) => sum + (center.ageSex?.[key]?.female ?? 0), 0) }));
  return <article className="report-paper" data-testid="report-preview"><div className="report-masthead"><div><div className="report-agency">MUNICIPALITY OF {organization.municipality.toUpperCase()}<br /><span style={{ fontSize:11, fontWeight:500 }}>{organization.desk.toUpperCase()}</span></div></div><div className="report-small">SITUATION REPORT<br />{report.reportNumber}<br />Generated {dateLabel(report.generatedAt)} · {timeLabel(report.generatedAt)}</div></div><h2 className="report-title">{report.incident.title}</h2><div className="report-small">{report.incident.code} · {report.incident.location} · {report.incident.incidentType}</div><div className="report-section"><h4>Incident status</h4><table className="report-table"><tbody><tr><td>Status</td><td>{report.incident.status}</td></tr><tr><td>Severity</td><td>{report.incident.severity}</td></tr><tr><td>Individuals affected</td><td>{number(report.incident.affectedPopulation)}</td></tr><tr><td>Individuals evacuated</td><td>{number(report.incident.evacuatedPopulation || centerPopulation)}</td></tr><tr><td>Deaths / injuries / missing</td><td>{report.incident.deaths} / {report.incident.injuries} / {report.incident.missing}</td></tr></tbody></table></div><div className="report-section"><h4>Age and sex breakdown</h4><table className="report-table"><thead><tr><th>Age group</th><th>Male</th><th>Female</th><th>Total</th></tr></thead><tbody>{ageTotals.map(row => <tr key={row.label}><td>{row.label}</td><td>{number(row.male)}</td><td>{number(row.female)}</td><td>{number(row.male + row.female)}</td></tr>)}<tr><td><strong>Counter-check total</strong></td><td><strong>{number(ageTotals.reduce((sum, row) => sum + row.male, 0))}</strong></td><td><strong>{number(ageTotals.reduce((sum, row) => sum + row.female, 0))}</strong></td><td><strong>{number(ageTotals.reduce((sum, row) => sum + row.male + row.female, 0))}</strong></td></tr></tbody></table></div><div className="report-section"><h4>Operational summary</h4><p>{report.operationalSummary}</p></div><div className="report-section"><h4>Priority needs</h4><p>{report.priorityNeeds}</p></div><div className="report-section"><h4>Actions taken</h4><p>{report.actionsTaken}</p></div><div className="report-section"><h4>Next steps</h4><p>{report.nextSteps}</p></div><div className="report-section"><h4>Resource and impact snapshot</h4><table className="report-table"><tbody><tr><td>Evacuation centers / sheltered individuals</td><td>{report.centers.length} / {number(centerPopulation)}</td></tr><tr><td>Families registered</td><td>{number(report.centers.reduce((s,c) => s+c.families,0))}</td></tr><tr><td>Partial / total damage</td><td>{partial} / {total}</td></tr><tr><td>Prepared by</td><td>{report.preparedBy}</td></tr></tbody></table></div><div className="report-small" style={{ marginTop:32, paddingTop:12, borderTop:'1px solid #dedfd5' }}>Report date: {dateLabel(report.reportDate)} · Official operational record</div></article>;
}

function SettingsPage() {
  const health = useHealthCheck({ query: { queryKey: ['health-settings'] as const } });
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<OrganizationProfile>(getLocalOrganizationProfile);
  const [saveError, setSaveError] = useState('');
  useEffect(() => {
    void getCloudOrganizationProfile().then(profile => {
      if (profile) setForm(profile);
    });
  }, []);
  const save = (event: FormEvent) => {
    event.preventDefault();
    setSaveError('');
    void saveOrganizationProfile(form).then(() => {
      window.localStorage.setItem(organizationProfileKey, JSON.stringify(form));
      window.dispatchEvent(new Event('organization-profile-updated'));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2600);
    }).catch(error => {
      setSaveError(error instanceof Error ? error.message : 'Unable to save organization profile.');
    });
  };
  return <div className="content"><div className="page-head"><div><div className="eyebrow">Workspace configuration</div><h1 className="page-title">Settings</h1><div className="page-desc">Keep the organization identity and duty officer details used in official reports up to date.</div></div></div><div className="two-col"><section className="panel"><div className="panel-header"><div><div className="panel-title">Organization profile</div><div className="panel-meta">Shared across authenticated users</div></div><Building2 size={17} color="#347d74" /></div><form className="panel-body" onSubmit={save}><div className="form-grid"><Field label="Municipality" full><input value={form.municipality} onChange={e => setForm({...form, municipality:e.target.value})} data-testid="input-settings-municipality" /></Field><Field label="Operations desk" full><input value={form.desk} onChange={e => setForm({...form, desk:e.target.value})} data-testid="input-settings-desk" /></Field><Field label="Duty officer"><input value={form.officer} onChange={e => setForm({...form, officer:e.target.value})} data-testid="input-settings-officer" /></Field><Field label="Contact email"><input type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} data-testid="input-settings-email" /></Field><Field label="Timezone"><select value={form.timezone} onChange={e => setForm({...form, timezone:e.target.value})} data-testid="select-settings-timezone"><option>Asia/Manila</option><option>UTC</option></select></Field></div><button className="btn btn-primary" style={{ marginTop:22 }} data-testid="button-save-settings"><Check size={14} /> Save workspace settings</button>{saved && <div style={{ color:'#2d7a6e', fontSize:11, marginTop:12 }} data-testid="status-settings-saved">Saved for all authenticated users.</div>}{saveError && <div className="error-state" style={{ marginTop:12 }}>{saveError}</div>}</form></section><section className="panel"><div className="panel-header"><div><div className="panel-title">System status</div><div className="panel-meta">Service availability</div></div><Shield size={17} color="#c08b2e" /></div><div className="panel-body"><div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:16, borderBottom:'1px solid #e9e4d9' }}><div><div className="incident-name">Disaster information API</div><div className="incident-location">Live data connection</div></div><StatusTag value={health.isSuccess ? 'Operational' : health.isLoading ? 'Checking' : 'Unavailable'} /></div><div style={{ paddingTop:18, color:'#72817b', fontSize:12, lineHeight:1.7 }}>This workspace uses a shared operational record. Changes made by another desk are reflected on the next live synchronization cycle.</div><div style={{ marginTop:22, background:'#edf3ee', padding:14, borderRadius:7, display:'flex', gap:10, alignItems:'flex-start' }}><Users size={15} color="#377f74" /><div><div style={{ fontSize:12, fontWeight:800, color:'#365953' }}>Shift handover ready</div><div style={{ fontSize:11, color:'#71817b', marginTop:3 }}>Your current officer profile is attached to report generation.</div></div></div></div></section></div></div>;
}

function UsersPage({ user }: { user: LocalUser }) {
  const cloudUsers = useListUsers();
  const displayedUsers = cloudUsers.data ?? [];
  const [savedId, setSavedId] = useState<string | null>(null);
  if (user.role !== 'Administrator') return <div className="content"><EmptyPanel title="Administrator access required" copy="Only the Super Administrator can assign workspace roles." /></div>;
  const saveRole = (account: LocalUser, role: LocalRole) => {
    void updateUserRole(account.id, role).then(() => cloudUsers.refetch()).catch(() => undefined);
    setSavedId(account.id);
    window.setTimeout(() => setSavedId(null), 1800);
  };
  return <div className="content"><div className="page-head"><div><div className="eyebrow">Access control</div><h1 className="page-title">User management</h1><div className="page-desc">Review local workspace accounts and assign the least access they need.</div></div><div className="access-note"><Shield size={14} /> Super Administrator view</div></div>
    <section className="panel"><div className="panel-header"><div><div className="panel-title">Workspace accounts</div><div className="panel-meta">Local accounts · role changes take effect immediately</div></div><Users size={17} color="#347d74" /></div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>User</th><th>Email</th><th>Status</th><th>Role</th><th>Joined</th></tr></thead><tbody>{displayedUsers.map(account => <tr key={account.id} data-testid={`row-user-${account.id}`}><td><div className="user-cell"><div className="user-avatar">{account.name.slice(0, 1).toUpperCase()}</div><div><div className="incident-name">{account.name}</div><div className="incident-location">{account.id}</div></div></div></td><td>{account.email}</td><td><StatusTag value={account.status} /></td><td><select className="select" value={account.role} onChange={e => saveRole(account, e.target.value as LocalRole)} disabled={account.id === user.id} data-testid={`select-user-role-${account.id}`}><option value="Administrator">Administrator</option><option value="Coordinator">Coordinator</option><option value="Viewer">Viewer</option></select>{savedId === account.id && <span className="saved-inline">Saved</span>}</td><td><span className="panel-meta">{dateLabel(account.createdAt)}</span></td></tr>)}</tbody></table></div>
    </section>
    <div className="role-grid"><div className="role-card"><div className="role-name">Administrator</div><div className="role-copy">Manage accounts and access every workspace function.</div></div><div className="role-card"><div className="role-name">Coordinator</div><div className="role-copy">Create and update incidents, shelters, damage records, and reports.</div></div><div className="role-card"><div className="role-name">Viewer</div><div className="role-copy">Read the operational picture without changing shared records.</div></div></div>
  </div>;
}

function Router({ user, onSignOut }: { user: LocalUser; onSignOut: () => void }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Shell user={user} onSignOut={onSignOut}><Switch><Route path="/" component={Dashboard} /><Route path="/incidents" component={IncidentsPage} /><Route path="/incidents/:id" component={IncidentDetail} /><Route path="/reports">{() => <ReportsPage user={user} />}</Route><Route path="/users">{() => <UsersPage user={user} />}</Route><Route path="/settings" component={SettingsPage} /><Route component={NotFound} /></Switch></Shell></ErrorBoundary>;
}

function LocalAuth({ onAuthenticated }: { onAuthenticated: (user: LocalUser) => void }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      if (mode === 'sign-up') {
        if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        await updateProfile(credential.user, { displayName: name.trim() });
        const existingUsers = await import('@/lib/firestore').then(module => module.listUsers());
        const account: LocalUser = { id: credential.user.uid, name: name.trim(), email: credential.user.email ?? email.trim(), role: existingUsers.length === 0 ? 'Administrator' : 'Viewer', createdAt: new Date().toISOString() };
        await upsertUser({ ...account, status: 'Active' });
        onAuthenticated(account);
        return;
      }
      const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      const profile = await getUser(credential.user.uid);
      if (!profile) { setError('Your account profile is not configured. Contact the administrator.'); return; }
      onAuthenticated({ id: profile.id, name: profile.name, email: profile.email, role: profile.role, createdAt: profile.createdAt });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setError(code.includes('auth/email-already-in-use') ? 'An account with this email already exists.' : code.includes('auth/invalid-credential') ? 'Invalid email or password.' : code || 'Authentication failed.');
    }
  };
  return <div className="auth-shell"><div className="auth-hero"><div className="brand-mark">/\/</div><div className="brand-title">sentinel</div><div className="brand-subtitle">Noveleta EOC</div><div className="auth-kicker">MUNICIPALITY OF NOVELETA / LOCAL DISASTER RISK REDUCTION AND MANAGEMENT OFFICE EOC</div><h1>One shared operational picture for every response desk.</h1><p>Firebase securely manages workspace accounts and sessions across browsers and devices.</p><div className="auth-points"><span><Shield size={14} /> First account is Super Administrator</span><span><Users size={14} /> Assign Coordinator or Viewer roles</span><span><Radio size={14} /> Firebase Authentication</span></div></div><form className="auth-card" onSubmit={submit}><div className="eyebrow">Firebase workspace login</div><h2>{mode === 'sign-in' ? 'Sign in to Sentinel' : 'Create administrator account'}</h2><p>{mode === 'sign-in' ? 'Use your Firebase account to continue.' : 'The first account automatically becomes Super Administrator.'}</p>{mode === 'sign-up' && <Field label="Full name" full><input value={name} onChange={e => setName(e.target.value)} required /></Field>}<Field label="Email" full><input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></Field><Field label="Password" full><input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required /></Field>{error && <div className="error-state">{error}</div>}<button className="btn btn-primary auth-action" type="submit"><Shield size={15} /> {mode === 'sign-in' ? 'Sign in' : 'Create account'}</button><button className="btn btn-secondary auth-action" type="button" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(''); }}>{mode === 'sign-in' ? 'Create account' : 'Back to sign in'}</button></form></div>;
}

function App() {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, async (firebaseUser: FirebaseUser | null) => {
      if (!firebaseUser) { setUser(null); setAuthLoading(false); return; }
      const profile = await getUser(firebaseUser.uid);
      setUser(profile ? { id: profile.id, name: profile.name, email: profile.email, role: profile.role, createdAt: profile.createdAt } : null);
      setAuthLoading(false);
    });
  }, []);
  const authenticate = (account: LocalUser) => setUser(account);
  const signOut = () => { void firebaseSignOut(firebaseAuth); setUser(null); };
  if (authLoading) return <div className="auth-loading"><LoaderCircle size={22} className="animate-spin" /> Checking Firebase session…</div>;
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>{user ? <Router user={user} onSignOut={signOut} /> : <LocalAuth onAuthenticated={authenticate} />}</WouterRouter></QueryClientProvider>;
}

export default App;