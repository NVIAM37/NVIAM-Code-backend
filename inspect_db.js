
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
    
    // Check the "new" project created by user
    const id = "695f87d6b1c9a0af6a5b2017";
    
    console.log(`Inspecting Project: ${id}`);
    const p = await Project.findById(id).lean();

    if (!p) {
        console.log("Project not found.");
    } else {
        console.log("Keys in root:", Object.keys(p));
        console.log("Has 'files' array?", !!p.files);
        if (p.files) {
            console.log("'files' length:", p.files.length);
            console.log("'files' content:", JSON.stringify(p.files));
        }
        console.log("'fileTree' keys:", Object.keys(p.fileTree || {}));
        console.log("Raw 'fileTree':", JSON.stringify(p.fileTree));
    }

    process.exit(0);
};

run();
