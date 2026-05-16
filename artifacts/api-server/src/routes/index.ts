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
import nowpaymentsIpnRouter from "./nowpayments-ipn";
import paymentLinksRouter from "./payment-links";
import notificationsRouter from "./notifications";
import supportRouter from "./support";
import merchantRouter from "./merchant";

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
router.use("/nowpayments", nowpaymentsIpnRouter);
router.use("/payment-links", paymentLinksRouter);
router.use("/notifications", notificationsRouter);
router.use("/support-links", supportRouter);
router.use("/merchant", merchantRouter);

export default router;
