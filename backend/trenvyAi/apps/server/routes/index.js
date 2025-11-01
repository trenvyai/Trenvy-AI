import express from "express";
import User from "./user.js";

const router = express.Router();

router.use("/users", User);

export default router;
