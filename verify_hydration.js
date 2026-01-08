
import mongoose from 'mongoose';
import './models/user.model.js'; // Register 'user' model
import * as projectService from './services/project.service.js';
import dotenv from 'dotenv';
dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://0.0.0.0/soen_db');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

const run = async () => {
    await connectDB();

    const projectId = "695f87d6b1c9a0af6a5b2017"; // User's failing project

    console.log(`\nVerifying Hydration for: ${projectId}`);
    
    try {
        const project = await projectService.getProjectById({ projectId });
        
        console.log("Returned Project Name:", project.name);
        console.log("Hydrated fileTree keys:", Object.keys(project.fileTree || {}));
        
        if (project.fileTree && project.fileTree['check.js']) {
             console.log("SUCCESS: 'check.js' is present in fileTree.");
             console.log("Content:", project.fileTree['check.js'].file.contents);
        } else {
             console.log("FAILURE: 'check.js' missing from fileTree.");
        }
        
    } catch (e) {
        console.error("Error calling service:", e.message);
    }

    process.exit(0);
};

run();
