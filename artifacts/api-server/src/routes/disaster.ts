import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, evacuationCentersTable, incidentsTable, structureDamagesTable } from "@workspace/db";
import {
  CreateEvacuationCenterBody,
  CreateEvacuationCenterResponse,
  CreateIncidentBody,
  CreateIncidentResponse,
  CreateStructureDamageBody,
  CreateStructureDamageResponse,
  DeleteEvacuationCenterParams,
  DeleteIncidentParams,
  DeleteStructureDamageParams,
  GenerateSituationalReportBody,
  GenerateSituationalReportResponse,
  GetDashboardSummaryResponse,
  GetIncidentOverviewParams,
  GetIncidentOverviewResponse,
  GetIncidentParams,
  GetIncidentResponse,
  ListEvacuationCentersQueryParams,
  ListEvacuationCentersResponse,
  ListIncidentsQueryParams,
  ListIncidentsResponse,
  ListStructureDamagesQueryParams,
  ListStructureDamagesResponse,
  UpdateEvacuationCenterBody,
  UpdateEvacuationCenterParams,
  UpdateEvacuationCenterResponse,
  UpdateIncidentBody,
  UpdateIncidentParams,
  UpdateIncidentResponse,
  UpdateStructureDamageBody,
  UpdateStructureDamageParams,
  UpdateStructureDamageResponse,
} from "@workspace/api-zod";
import {
  buildIncidentSearch,
  dashboardSummary,
  ensureSeedData,
  getCentersForIncident,
  getDamagesForIncident,
  getIncidentById,
  incidentOverview,
  parseId,
  touchIncident,
} from "../lib/disaster";
import { requireEditor } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/incidents", async (req, res): Promise<void> => {
  await ensureSeedData();
  const query = ListIncidentsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const conditions = [];
  if (query.data.status) conditions.push(eq(incidentsTable.status, query.data.status));
  const search = buildIncidentSearch(query.data.search);
  if (search) conditions.push(search);
  const incidents = await db
    .select()
    .from(incidentsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(incidentsTable.updatedAt));
  res.json(ListIncidentsResponse.parse(incidents));
});

router.post("/incidents", requireEditor, async (req, res): Promise<void> => {
  const parsed = CreateIncidentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [incident] = await db
    .insert(incidentsTable)
    .values({
      ...parsed.data,
      code: `INC-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
    })
    .returning();
  res.status(201).json(CreateIncidentResponse.parse(incident));
});

router.get("/incidents/:id", async (req, res): Promise<void> => {
  const params = GetIncidentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const incident = await getIncidentById(params.data.id);
  if (!incident) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }
  res.json(GetIncidentResponse.parse(incident));
});

router.patch("/incidents/:id", requireEditor, async (req, res): Promise<void> => {
  const params = UpdateIncidentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateIncidentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [incident] = await db
    .update(incidentsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(incidentsTable.id, params.data.id))
    .returning();
  if (!incident) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }
  res.json(UpdateIncidentResponse.parse(incident));
});

router.delete("/incidents/:id", requireEditor, async (req, res): Promise<void> => {
  const params = DeleteIncidentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [incident] = await db
    .delete(incidentsTable)
    .where(eq(incidentsTable.id, params.data.id))
    .returning();
  if (!incident) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/incidents/:id/overview", async (req, res): Promise<void> => {
  const params = GetIncidentOverviewParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const overview = await incidentOverview(params.data.id);
  if (!overview) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }
  res.json(GetIncidentOverviewResponse.parse(overview));
});

router.get("/evacuation-centers", async (req, res): Promise<void> => {
  await ensureSeedData();
  const query = ListEvacuationCentersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const conditions = [];
  if (query.data.incidentId) conditions.push(eq(evacuationCentersTable.incidentId, query.data.incidentId));
  if (query.data.search) conditions.push(eq(evacuationCentersTable.barangay, query.data.search));
  const centers = await db
    .select()
    .from(evacuationCentersTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(evacuationCentersTable.currentPopulation));
  res.json(ListEvacuationCentersResponse.parse(centers));
});

router.post("/evacuation-centers", requireEditor, async (req, res): Promise<void> => {
  const parsed = CreateEvacuationCenterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [center] = await db.insert(evacuationCentersTable).values(parsed.data).returning();
  await touchIncident(parsed.data.incidentId);
  res.status(201).json(CreateEvacuationCenterResponse.parse(center));
});

router.patch("/evacuation-centers/:id", requireEditor, async (req, res): Promise<void> => {
  const params = UpdateEvacuationCenterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateEvacuationCenterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [center] = await db
    .update(evacuationCentersTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(evacuationCentersTable.id, params.data.id))
    .returning();
  if (!center) {
    res.status(404).json({ error: "Evacuation center not found" });
    return;
  }
  await touchIncident(center.incidentId);
  res.json(UpdateEvacuationCenterResponse.parse(center));
});

router.delete("/evacuation-centers/:id", requireEditor, async (req, res): Promise<void> => {
  const params = DeleteEvacuationCenterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [center] = await db
    .delete(evacuationCentersTable)
    .where(eq(evacuationCentersTable.id, params.data.id))
    .returning();
  if (!center) {
    res.status(404).json({ error: "Evacuation center not found" });
    return;
  }
  await touchIncident(center.incidentId);
  res.sendStatus(204);
});

router.get("/structure-damages", async (req, res): Promise<void> => {
  await ensureSeedData();
  const query = ListStructureDamagesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const damages = await db
    .select()
    .from(structureDamagesTable)
    .where(query.data.incidentId ? eq(structureDamagesTable.incidentId, query.data.incidentId) : undefined)
    .orderBy(desc(structureDamagesTable.totallyDamaged));
  res.json(ListStructureDamagesResponse.parse(damages));
});

router.post("/structure-damages", requireEditor, async (req, res): Promise<void> => {
  const parsed = CreateStructureDamageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [damage] = await db.insert(structureDamagesTable).values(parsed.data).returning();
  await touchIncident(parsed.data.incidentId);
  res.status(201).json(CreateStructureDamageResponse.parse(damage));
});

router.patch("/structure-damages/:id", requireEditor, async (req, res): Promise<void> => {
  const params = UpdateStructureDamageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateStructureDamageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [damage] = await db
    .update(structureDamagesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(structureDamagesTable.id, params.data.id))
    .returning();
  if (!damage) {
    res.status(404).json({ error: "Damage assessment not found" });
    return;
  }
  await touchIncident(damage.incidentId);
  res.json(UpdateStructureDamageResponse.parse(damage));
});

router.delete("/structure-damages/:id", requireEditor, async (req, res): Promise<void> => {
  const params = DeleteStructureDamageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [damage] = await db
    .delete(structureDamagesTable)
    .where(eq(structureDamagesTable.id, params.data.id))
    .returning();
  if (!damage) {
    res.status(404).json({ error: "Damage assessment not found" });
    return;
  }
  await touchIncident(damage.incidentId);
  res.sendStatus(204);
});

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  await ensureSeedData();
  res.json(GetDashboardSummaryResponse.parse(await dashboardSummary()));
});

router.post("/reports/situational", async (req, res): Promise<void> => {
  const parsed = GenerateSituationalReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const incident = await getIncidentById(parsed.data.incidentId);
  if (!incident) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }
  const [centers, damages] = await Promise.all([
    getCentersForIncident(incident.id),
    getDamagesForIncident(incident.id),
  ]);
  const report = {
    reportNumber: `SITREP-${new Date(parsed.data.reportDate).toISOString().slice(0, 10).split("-").join("")}-${String(incident.id).padStart(3, "0")}`,
    generatedAt: new Date(),
    reportDate: parsed.data.reportDate,
    preparedBy: parsed.data.preparedBy,
    incident,
    centers,
    damages,
    operationalSummary: parsed.data.operationalSummary,
    priorityNeeds: parsed.data.priorityNeeds,
    actionsTaken: parsed.data.actionsTaken,
    nextSteps: parsed.data.nextSteps,
  };
  res.json(GenerateSituationalReportResponse.parse(report));
});

export default router;