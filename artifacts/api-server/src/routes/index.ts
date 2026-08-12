import { Router, type IRouter } from "express";
import healthRouter from "./health";
import appointmentsRouter from "./appointments";
import servicesRouter from "./services";
import openaiRouter from "./openai";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(appointmentsRouter);
router.use(servicesRouter);
router.use(openaiRouter);
router.use(adminRouter);

export default router;
