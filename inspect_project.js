
import mongoose from 'mongoose';
import Project from './models/project.model.js';
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

    console.log(`\nInspecting Project: ${projectId}`);
    
    // Use lean() to get raw JSON
    const rawDoc = await Project.findById(projectId).lean();
    
    if (!rawDoc) {
        console.log("Project not found.");
    } else {
        console.log("Found Project:", rawDoc.name);
        console.log("fileTree keys:", Object.keys(rawDoc.fileTree || {}));
        console.log("files array:", rawDoc.files); // Will be undefined if missing
        
        // Detailed check
        if (rawDoc.files === undefined) {
             console.log("CRITICAL: 'files' field is UNDEFINED in document.");
        } else {
             console.log(`'files' length: ${rawDoc.files.length}`);
             rawDoc.files.forEach(f => console.log(` - ${f.name}`));
        }
    }

    process.exit(0);
};

run();
