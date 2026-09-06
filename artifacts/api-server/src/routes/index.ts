import { Router, type IRouter } from "express";
import healthRouter from "./health";
import disasterRouter from "./disaster";
import usersRouter from "./users";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireAuth);
router.use(disasterRouter);
router.use(usersRouter);

export default router;
