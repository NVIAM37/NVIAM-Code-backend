import jwt from "jsonwebtoken";
import redisClient from "../services/redis.service.js";
import userModel from "../models/user.model.js";


export const authUser = async (req, res, next) => {
    try {
        const token = req.cookies.token || (req.headers.authorization?.split(' ')[ 1 ]);

        if (!token) {
            return res.status(401).send({ error: 'Unauthorized User' });
        }


        try {
            const isBlackListed = await redisClient.get(token);

            if (isBlackListed) {
                res.cookie('token', '');
                return res.status(401).send({ error: 'Unauthorized User' });
            }
        } catch (error) {
            // Redis is optional, fail open if connection fails
            // console.warn("Redis blacklist check failed, proceeding without it.");
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // EXTRA SECURITY: Check if user actually exists in DB (Handles 'DB Dropped' case)
        const user = await userModel.findOne({ email: decoded.email });
        if (!user) {
            return res.status(401).send({ error: 'User validation failed' });
        }

        req.user = decoded;
        next();
    } catch (error) {

        console.log(error);

        res.status(401).send({ error: 'Unauthorized User' });
    }
}