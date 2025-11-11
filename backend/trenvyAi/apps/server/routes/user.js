import express from "express";
const router = express.Router();
import jwt from "jsonwebtoken";
import redisClient from '../microservices/Redisserver.js'
import prisma from "../database/prismaClient.js";
import { hashPassword, comparepassword } from '../services/HashPassword.js'
import { sendSignupOTP, resetPasswordOTP } from '../services/EmailService.js'
import { OtpGenrater } from '../services/OtpGenrater.js'
import passport from "../services/authcontroller.js";
<<<<<<< HEAD
// in this route user signup is handled
// from the frontend we are expecting @username,@name,@email,@password
// if any of the thing is not available in the JSON we are throwing the error
router.post('/signup', async(req, res) => {
    try{
        // console.log("here in the signup token")
        // console.log(req.body)
=======
import { isUsernameTaken, addUsername, getStats } from "../services/UsernameVerifier.js";

router.post('/signup', async (req, res) => {
    try {
>>>>>>> 96d68615d62b7ae4246111a12ec68244c6a762f3
        const body = req.body;
        const { username, password, email, name } = body;
        if (!body.username || !body.password || !body.email) {
            return res.status(401).send({ message: "all fields are required" });
        }

        // Check username availability using Bloom filter
        const usernameCheck = await isUsernameTaken(username);
        if (!usernameCheck.available) {
            return res.status(401).send({ message: "Username already taken" });
        }

        const ExistingUser = await prisma.user.findUnique({
            where: {
                email: email,
            }
        })
        if (ExistingUser) {
            return res.status(401).send({ message: "User already exists" });
        }
        const otp = OtpGenrater();
        await sendSignupOTP(body.email, body.name, otp);
        const userData = { username, name, email, password, otp };
        await redisClient.setEx(`pendingUser:${email}`, 600, JSON.stringify(userData));
        return res.status(200).send({ message: "successfully sent", UserEmail: email });
    } catch (err) {
        console.log(err)
        return res.status(500).send({ message: "error occurred" });
    }
});
router.post('/signup-otp-verification', async (req, res) => {
    try {
        const { email, otp } = req.body;
        // console.log(req.body)
        const data = await redisClient.get(`pendingUser:${email}`)
        // console.log(data)
        if (!data) {
            return res.status(401).send({ message: "OTP expired" });
        }
        const userData = JSON.parse(data);
        // console.log(userData)
        if (userData.otp.toString() !== otp.toString()) {
            return res.status(401).send({ message: "wrong otp" });
        }
        const userhashPassword = await hashPassword(userData.password);
        //     save the user in the main db and return the jwt token and redirect to the dashboard
        const user = await prisma.user.create({
            data: {
                email: email,
                password: userhashPassword,
                username: userData.username,
                name: userData.name,
                isVerified: true
            }
        })
        
        // Add username to Bloom filter
        addUsername(userData.username);
        
        await redisClient.del(`pendingUser:${email}`);
        const token = jwt.sign(
            { id: user.id, email: email },
            process.env.JWT_SECRET || "secret123",
            { expiresIn: "7d" }
        );
        return res.status(201).json({
            message: "Signup successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
        });
    } catch (err) {
        console.log(err)
        return res.status(500).send({ message: "error occurred" });
    }
});
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
//Handle Google callback
router.get("/google/callback", passport.authenticate("google", { session: false }), (req, res) => {
    // req.user is set in the Google strategy `done(null, { user, token })`
    try {
        const { user, token } = req.user;
        console.log(req.user);
        res.status(200).json({
            message: "Google authentication successful",
            user,
            token,
        });
    } catch (e) {
        return res.status(500).send({ message: "error occurred" });

    }
}
);
router.post('/login', async (req, res) => {
    try {
        const { search, password } = req.body;
        const data = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: search },
                    { username: search },
                ],
            },
        });
        if (!data) {
            return res.status(400).json({ message: "user not found" });
        }
        if (!comparepassword(password, data.password)) {
            return res.status(401).send({ message: "wrong password" });
        }
        const token = jwt.sign(
            { id: data.id },
            Process.env.JWT_SECRET || "secret123",
            { expiresIn: "7d" }
        );
        await redisClient.setEx(`${data.id}`, 600, JSON.stringify(data))
        return res.status(200).json({ data: { data, token } });
    } catch (err) {
        console.log(err)
        return res.status(500).send({ message: "error occurred" });
    }
});
router.post('/resetpassword', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(401).send({ message: "email is required" });
        }
        const ExistingUser = await prisma.user.findUnique({
            where: {
                email: email,
            }
        })
        if (!ExistingUser) {
            return res.status(401).send({ message: "Invalid email" });
        }
        const otp = OtpGenrater();
        await resetPasswordOTP(email, otp);
        const userData = { email, otp };
        await redisClient.setEx(`pendingUser:${email}`, 600, JSON.stringify(userData));
        return res.status(200).send({ message: "successfully sent", UserEmail: email });
    } catch (err) {
        console.log(err);
        return res.status(500).send({ message: "error occurred" });
    }
});

// Check username availability
router.get('/check-username/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        if (!username || username.length < 3) {
            return res.status(400).send({ message: "Username must be at least 3 characters" });
        }

        const result = await isUsernameTaken(username);
        
        return res.status(200).json({
            username,
            available: result.available,
            checkedWithDb: result.needsDbCheck,
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send({ message: "error occurred" });
    }
});

// Get Bloom filter statistics (admin/debug endpoint)
router.get('/bloom-stats', async (_req, res) => {
    try {
        const stats = getStats();
        return res.status(200).json(stats);
    } catch (err) {
        console.log(err);
        return res.status(500).send({ message: "error occurred" });
    }
});

export default router;