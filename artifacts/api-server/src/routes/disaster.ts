import { Router, type IRouter } from "express";
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
  createEvacuationCenter,
  createIncident,
  createStructureDamage,
  dashboardSummary,
  deleteEvacuationCenter,
  deleteIncident,
  deleteStructureDamage,
  ensureSeedData,
  getCentersForIncident,
  getDamagesForIncident,
  getIncidentById,
  incidentOverview,
  listEvacuationCenters,
  listIncidents,
  listStructureDamages,
  updateEvacuationCenter,
  updateIncident,
  updateStructureDamage,
} from "../lib/disaster";

const router: IRouter = Router();

router.get("/incidents", async (req, res): Promise<void> => {
  await ensureSeedData();
  const query = ListIncidentsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const incidents = await listIncidents(query.data.status, query.data.search);
  res.json(ListIncidentsResponse.parse(incidents));
});

router.post("/incidents", async (req, res): Promise<void> => {
  const parsed = CreateIncidentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const incident = await createIncident(parsed.data);
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

router.patch("/incidents/:id", async (req, res): Promise<void> => {
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
  const incident = await updateIncident(params.data.id, parsed.data);
  if (!incident) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }
  res.json(UpdateIncidentResponse.parse(incident));
});

router.delete("/incidents/:id", async (req, res): Promise<void> => {
  const params = DeleteIncidentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!(await deleteIncident(params.data.id))) {
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
  const centers = await listEvacuationCenters(
    query.data.incidentId,
    query.data.search,
  );
  res.json(ListEvacuationCentersResponse.parse(centers));
});

router.post("/evacuation-centers", async (req, res): Promise<void> => {
  const parsed = CreateEvacuationCenterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const center = await createEvacuationCenter(parsed.data);
  res.status(201).json(CreateEvacuationCenterResponse.parse(center));
});

router.patch("/evacuation-centers/:id", async (req, res): Promise<void> => {
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
  const center = await updateEvacuationCenter(params.data.id, parsed.data);
  if (!center) {
    res.status(404).json({ error: "Evacuation center not found" });
    return;
  }
  res.json(UpdateEvacuationCenterResponse.parse(center));
});

router.delete("/evacuation-centers/:id", async (req, res): Promise<void> => {
  const params = DeleteEvacuationCenterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const center = await deleteEvacuationCenter(params.data.id);
  if (!center) {
    res.status(404).json({ error: "Evacuation center not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/structure-damages", async (req, res): Promise<void> => {
  await ensureSeedData();
  const query = ListStructureDamagesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const damages = await listStructureDamages(query.data.incidentId);
  res.json(ListStructureDamagesResponse.parse(damages));
});

router.post("/structure-damages", async (req, res): Promise<void> => {
  const parsed = CreateStructureDamageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const damage = await createStructureDamage(parsed.data);
  res.status(201).json(CreateStructureDamageResponse.parse(damage));
});

router.patch("/structure-damages/:id", async (req, res): Promise<void> => {
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
  const damage = await updateStructureDamage(params.data.id, parsed.data);
  if (!damage) {
    res.status(404).json({ error: "Damage assessment not found" });
    return;
  }
  res.json(UpdateStructureDamageResponse.parse(damage));
});

router.delete("/structure-damages/:id", async (req, res): Promise<void> => {
  const params = DeleteStructureDamageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const damage = await deleteStructureDamage(params.data.id);
  if (!damage) {
    res.status(404).json({ error: "Damage assessment not found" });
    return;
  }
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