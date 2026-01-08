
import mongoose from 'mongoose';
import Project from './models/project.model.js';
import dotenv from 'dotenv';
dotenv.config();

// Connect to DB (assuming local or pulled from env)
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

    // 1. Create a dummy project
    const projectId = new mongoose.Types.ObjectId();
    const p = await Project.create({
        _id: projectId,
        name: `debug-project-${Date.now()}`,
        users: [], // Relaxed validation for now
        fileTree: {}
    });
    console.log("Created Project:", p._id);

    // 2. Try to update with a file containing dots
    const fileTree = {
        "check.js": { file: { contents: "console.log('test')" } }
    };

    console.log("Attempting to save:", JSON.stringify(fileTree));

    const updated = await Project.findOneAndUpdate(
        { _id: projectId },
        { fileTree },
        { new: true }
    );

    console.log("Updated Project FileTree:", JSON.stringify(updated.fileTree));

    if (updated.fileTree['check.js']) {
        console.log("SUCCESS: Saved file with dot.");
    } else {
        console.log("FAILURE: Key with dot missing.");
    }

    // Cleanup
    await Project.findByIdAndDelete(projectId);
    process.exit(0);
};

run();
