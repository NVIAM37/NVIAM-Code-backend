
import mongoose from 'mongoose';
import Project from './models/project.model.js';
import * as projectService from './services/project.service.js';
import dotenv from 'dotenv';
dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://0.0.0.0/soen_db');
        console.log('MongoDB Connected');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

const run = async () => {
    await connectDB();

    const projectId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId(); // Dummy user

    console.log(`\n--- STEP 1: Create Project ---`);
    const p = await Project.create({
        _id: projectId,
        name: `verify-v3-${Date.now()}`,
        users: [userId], // Ensure valid user ID
        fileTree: {},
        files: []
    });
    console.log("Project Created:", p._id);

    console.log(`\n--- STEP 2: Update FileTree (Simulate Frontend Save) ---`);
    const fileTreeInput = {
        "check.js": { file: { contents: "console.log('check.js')" } },
        "main.js": { file: { contents: "console.log('main.js')" } }
    };

    const updatedProject = await projectService.updateFileTree({
        projectId: projectId,
        fileTree: fileTreeInput
    });

    console.log("Updated Project Return Value Keys:", Object.keys(updatedProject.fileTree));
    if (updatedProject.fileTree["check.js"]) {
        console.log("SUCCESS: 'check.js' is present in update response.");
    } else {
        console.log("FAILURE: 'check.js' is MISSING in update response.");
    }

    console.log(`\n--- STEP 3: Read Back (Simulate Refresh) ---`);
    // Re-fetch clean
    const fetchedProject = await projectService.getProjectById({ projectId });
    
    console.log("Fetched Project Keys:", Object.keys(fetchedProject.fileTree || {}));
    if (fetchedProject.fileTree && fetchedProject.fileTree["check.js"]) {
         console.log("SUCCESS: 'check.js' persists after fetch.");
    } else {
         console.log("FAILURE: 'check.js' lost on fetch.");
         console.log("Dump Files Array:", JSON.stringify(fetchedProject.files));
    }

    /* Cleanup */
    await Project.findByIdAndDelete(projectId);
    process.exit(0);
};

run();
