import { Router, type IRouter } from "express";
import healthRouter from "./health";
import appointmentsRouter from "./appointments";
import servicesRouter from "./services";
import openaiRouter from "./openai";
import adminRouter from "./admin";
import adminAvailabilityRouter from "./admin-availability";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(appointmentsRouter);
router.use(servicesRouter);
router.use(openaiRouter);
router.use(adminRouter);
router.use(adminAvailabilityRouter);
router.use(paymentsRouter);

export default router;
