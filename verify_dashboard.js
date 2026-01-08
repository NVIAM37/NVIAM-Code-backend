
import mongoose from 'mongoose';
import * as projectService from './services/project.service.js';
import './models/user.model.js';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://0.0.0.0/soen_db');

    const userId = "695e992dbf57eb50e14d103d"; // From user's log: "test@test.com"
    console.log(`\nVerifying Dashboard for User: ${userId}`);

    try {
        const projects = await projectService.getAllProjectByUserId({ userId });
        const targetProject = projects.find(p => p.name === 'new');
        
        if (targetProject) {
            console.log("Found Project 'new' in dashboard list.");
            console.log("FileTree Keys:", Object.keys(targetProject.fileTree || {}));
            if (targetProject.fileTree && targetProject.fileTree['check.js']) {
                console.log("SUCCESS: 'check.js' present in dashboard list.");
            } else {
                 console.log("FAILURE: 'check.js' missing in dashboard list.");
            }
        } else {
            console.log("Project 'new' not found (maybe wrong user ID?).");
            console.log("Projects found:", projects.map(p => p.name));
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
    process.exit(0);
};

run();
