import express from "express";
const router = express.Router();
import jwt from "jsonwebtoken";
import redisClient from'../microservices/Redisserver.js'
import prisma from "../database/prismaClient.js";
import {hashPassword} from'../services/HashPassword.js'
import {sendSignupOTP} from'../services/EmailService.js'
import {OtpGenrater} from'../services/OtpGenrater.js'
router.post('/signup', async(req, res) => {
    try{
        // console.log("here in the signup token")
        // console.log(req.body)
        const body = req.body;
        const {username , password , email , name} = body;
        if (!body.username || !body.password||!body.email) {
            return res.status(401).send({message:"all fields are required"});
        }
        const ExistingUser = await prisma.user.findUnique({
            where: {
                email: email,
            }
        })
        if(ExistingUser){
            return res.status(401).send({message:"User already exists"});
        }
        const otp =  OtpGenrater();
        await sendSignupOTP(body.email , body.name , otp);
        const userData = { username, name, email, password, otp };
        await redisClient.setEx(`pendingUser:${email}`, 600, JSON.stringify(userData));
        return res.status(200).send({message:"successfully sent",UserEmail:email});
    }catch(err){
        console.log(err)
        return res.status(500).send({message:"error occurred"});
    }
})
router.post('/signup-otp-verification', async(req, res) => {
    try{
        const {email , otp} = req.body;
        // console.log(req.body)
        const data = await redisClient.get(`pendingUser:${email}`)
        // console.log(data)
        if(!data){
            return res.status(401).send({message:"OTP expired"});
        }
        const userData = JSON.parse(data);
        // console.log(userData)
        if(userData.otp.toString()!==otp.toString()){
            return res.status(401).send({message:"wrong otp"});
        }
        const userhashPassword = await hashPassword(userData.password);
    //     save the user in the main db and return the jwt token and redirect to the dashboard
        const user = await prisma.user.create({
            data:{
                email: email,
                password: userhashPassword,
                username: userData.username,
                name: userData.name,
                isVerified:true
            }
        })
        // console.log(user)
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
    }catch(err){
        console.log(err)
        return res.status(500).send({message:"error occurred"});
    }
})
export default router;