import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import walletsRouter from "./wallets";
import transactionsRouter from "./transactions";
import dashboardRouter from "./dashboard";
import servicesRouter from "./services";
import apiKeysRouter from "./apikeys";
import kycRouter from "./kyc";
import adminRouter from "./admin";
import ipnRouter from "./ipn";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/wallets", walletsRouter);
router.use("/transactions", transactionsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/services", servicesRouter);
router.use("/api-keys", apiKeysRouter);
router.use("/kyc", kycRouter);
router.use("/admin", adminRouter);
router.use("/ipn", ipnRouter);

export default router;
