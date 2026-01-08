
import mongoose from 'mongoose';
import * as projectController from './controllers/project.controller.js';
import './models/user.model.js'; // Register models
import dotenv from 'dotenv';
dotenv.config();

// Mock Express Req/Res
const mockReq = (params = {}, body = {}) => ({
    params,
    body,
    user: { email: 'test@test.com' } // Dummy
});

const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    return res;
};

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://0.0.0.0/soen_db');

    const projectId = "695f87d6b1c9a0af6a5b2017"; // User's failing project
    console.log(`\nVerifying Controller for: ${projectId}`);

    const req = mockReq({ projectId });
    const res = mockRes();

    await projectController.getProjectById(req, res);

    if (res.data && res.data.project) {
        const p = res.data.project;
        console.log("Controller returned project:", p.name);
        console.log("FileTree Keys:", Object.keys(p.fileTree || {}));
        
        if (p.fileTree && p.fileTree['check.js']) {
            console.log("SUCCESS: 'check.js' found in controller response.");
        } else {
            console.log("FAILURE: 'check.js' missing in controller response.");
        }
    } else {
        console.log("FAILURE: Controller returned no data or error.", res.data);
    }

    process.exit(0);
};

run();
