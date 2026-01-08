
import mongoose from 'mongoose';
import Project from './models/project.model.js';
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

    const projectId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    console.log(`\n(V4) Test Persistence after Schema Restart`);
    
    // 1. Create
    await Project.create({
        _id: projectId,
        name: `verify-v4-${Date.now()}`,
        users: [userId],
        fileTree: {},
        files: []
    });

    // 2. Update via Service (Simulate Frontend Save)
    const fileTreeInput = {
        "check.js": { file: { contents: "console.log('check.js')" } }
    };

    console.log("Saving 'check.js'...");
    await projectService.updateFileTree({
        projectId: projectId,
        fileTree: fileTreeInput
    });

    // 3. Inspect RAW DB
    const rawDoc = await Project.findById(projectId).lean();
    console.log("DB 'files' array length:", rawDoc.files ? rawDoc.files.length : 'UNDEFINED');

    if (rawDoc.files && rawDoc.files.length > 0 && rawDoc.files[0].name === 'check.js') {
        console.log("SUCCESS: 'files' array populated correctly in DB.");
    } else {
        console.log("FAILURE: 'files' array still missing/empty.");
    }

    // Cleanup
    await Project.findByIdAndDelete(projectId);
    process.exit(0);
};

run();
