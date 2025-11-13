import express from "express";
import User from "./user.js";
import UserProfile from "./userprofile.js";
import PasswordReset from "./passwordReset.js";
import Monitoring from "./monitoring.js";

const router = express.Router();

// Mount user routes on both /users and /user for backward compatibility
router.use(["/users", "/user"], User);
router.use("/profile", UserProfile);

// Password reset routes (production-grade)
router.use("/auth", PasswordReset);

// Monitoring routes (metrics and health checks)
router.use("/", Monitoring);

export default router;
