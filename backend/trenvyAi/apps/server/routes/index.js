import express from "express";
import User from "./user.js";
import UserProfile from "./userprofile.js";

const router = express.Router();

// Mount user routes on both /users and /user for backward compatibility
router.use(["/users", "/user"], User);
router.use("/profile", UserProfile);

export default router;
