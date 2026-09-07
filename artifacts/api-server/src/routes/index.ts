import { Router, type IRouter } from "express";
import healthRouter from "./health";
import disasterRouter from "./disaster";

const router: IRouter = Router();

router.use(healthRouter);
router.use(disasterRouter);

export default router;
