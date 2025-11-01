// we need to make it to handle the all the google auth
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import prisma from "../database/prismaClient.js";
import jwt from "jsonwebtoken";

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "http://localhost:3000/api/v1/users/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                const name = profile.displayName;
                const googleId = profile.id;
                let user = await prisma.user.findUnique({
                    where: { email },
                });
                if (!user) {
                    user = await prisma.user.create({
                        data: {
                            name:name,
                            email:email,
                            username: name.replace(/\s+/g, "").toLowerCase(),
                            googleId:googleId,
                            isVerified: true,
                        },
                    });
                    console.log("New user created:", user.email);
                } else {
                    console.log("Existing user found:", user.email);
                }
                const token = jwt.sign(
                    { id: user.id, email: user.email },
                    process.env.JWT_SECRET || "secret123",
                    { expiresIn: "7d" }
                );

                // Pass user and token to the route handler
                return done(null, { user, token });
            } catch (error) {
                console.error("Google auth error:", error);
                return done(error, null);
            }
        }
    )
);

export default passport;
