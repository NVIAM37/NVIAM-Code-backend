
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

    const projectId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    console.log(`\n(Chat) Test Message Persistence`);
    
    // 1. Create
    await Project.create({
        _id: projectId,
        name: `verify-chat-${Date.now()}`,
        users: [userId],
        fileTree: {},
        files: [],
        messages: []
    });

    // 2. Add Message using update logic (simulating server.js)
    const msg = {
        message: "Hello AI",
        sender: { _id: userId, email: "test@test.com" }
    };

    await Project.findByIdAndUpdate(projectId, {
        $push: { messages: msg }
    });

    // 3. Inspect DB
    const rawDoc = await Project.findById(projectId).lean();
    console.log("DB 'messages' array length:", rawDoc.messages ? rawDoc.messages.length : 'UNDEFINED');

    if (rawDoc.messages && rawDoc.messages.length === 1 && rawDoc.messages[0].message === "Hello AI") {
        console.log("SUCCESS: Message saved correctly.");
    } else {
        console.log("FAILURE: Message not saved.");
    }

    // Cleanup
    await Project.findByIdAndDelete(projectId);
    process.exit(0);
};

run();
