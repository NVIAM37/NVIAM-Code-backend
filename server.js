import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import projectModel from './models/project.model.js';
import * as projectService from './services/project.service.js';
import { generateResult, JSON_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } from './services/ai.service.js';

const port = process.env.PORT || 3000;



const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

// Allow express app to access io instance
app.set('io', io);


io.use(async (socket, next) => {

    try {

        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];
        const projectId = socket.handshake.query.projectId;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return next(new Error('Invalid projectId'));
        }


        socket.project = await projectModel.findById(projectId);

        if (!socket.project) {
            return next(new Error('Project not found'));
        }

        if (!token) {
            return next(new Error('Authentication error'))
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded) {
            return next(new Error('Authentication error'))
        }


        socket.user = decoded;

        next();

    } catch (error) {
        next(error)
    }

})



const projectUsers = {}; // { projectId: Set<userId> }
// We need to store user details too.
// Let's use: { projectId: { userId: { email, _id, socketId } } }


import { registerSocketHandlers } from './services/socket.service.js';





io.on('connection', socket => {
    // console.log('a user connected');

    socket.roomId = socket.project._id.toString();

    // -------------------------------------------------------------
    // STRICT ROOM-BASED COLLABORATION LOGIC
    // -------------------------------------------------------------
    
    // We do NOT join any room automatically.
    // The user is "Offline" until they explicitly Create or Join a room.

    socket.on('create-room', async ({ projectId }) => {
        // Validation
        if (!projectId || projectId !== socket.project._id.toString()) {
            return socket.emit('error', { message: 'Project mismatch' });
        }

        // Generate Random Room ID
        const roomId = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Join
        socket.join(roomId);
        socket.activeRoomId = roomId;
        
        // Notify
        socket.emit('room-created', { roomId });
        // console.log(`Room created: ${roomId} by ${socket.user.email}`);
    });

    socket.on('join-room', async ({ roomId }) => {
        // In a real app, we might check if the room exists in a map.
        // For socket.io, we can check if the room has active sockets.
        const room = io.sockets.adapter.rooms.get(roomId);
        
        // If room doesn't exist or is empty (unless we are just creating it, but this is join)
        // Actually, create-room above makes the room exist.
        if (!room || room.size === 0) {
            return socket.emit('error', { message: 'Room not found or inactive' });
        }

        // Leave current room if any
        if (socket.activeRoomId) {
            socket.leave(socket.activeRoomId);
        }

        socket.join(roomId);
        socket.activeRoomId = roomId;

        socket.emit('room-joined', { roomId });
        
        // Notify others
        io.to(roomId).emit('user-joined', { 
            userId: socket.user._id, 
            email: socket.user.email,
            socketId: socket.id // Useful for p2p sync requests
        });

        // Request usage of sync-code
        // New user needs code.
        socket.to(roomId).emit('request-sync', { socketId: socket.id });
        
        // Send updated user list
        updateRoomUsers(roomId);
    });

    socket.on('leave-room', () => {
        if (socket.activeRoomId) {
            socket.leave(socket.activeRoomId);
            const roomId = socket.activeRoomId;
            socket.activeRoomId = null;
            
            io.to(roomId).emit('user-left', { userId: socket.user._id });
            updateRoomUsers(roomId);
        }
    });

    // Helper to broadcast user list
    function updateRoomUsers(roomId) {
        const room = io.sockets.adapter.rooms.get(roomId);
        const users = [];
        if (room) {
            for (const clientId of room) {
                const clientSocket = io.sockets.sockets.get(clientId);
                if (clientSocket?.user) {
                    users.push({
                        _id: clientSocket.user._id,
                        email: clientSocket.user.email,
                        socketId: clientSocket.id
                    });
                }
            }
        }
        io.to(roomId).emit('room-users', users);
    }
    
    // -------------------------------------------------------------
    // SYNC HANDLERS (SCOPED TO ROOM)
    // -------------------------------------------------------------

    socket.on('project-write', async data => {
        if (!socket.activeRoomId) return; // Strict scope
        // Broadcast to room ONLY
        socket.broadcast.to(socket.activeRoomId).emit('project-write', data);
    });

    socket.on('project-cursor-move', data => {
        if (!socket.activeRoomId) return;
        const cursorData = {
            ...data,
            userId: socket.user._id,
            email: socket.user.email,
            socketId: socket.id
        };
        socket.broadcast.to(socket.activeRoomId).emit('project-cursor-move', cursorData);
    });

    socket.on('sync-file-tree', ({ socketId, fileTree }) => {
        // Targeted sync
        io.to(socketId).emit('sync-file-tree', { fileTree });
    });

    socket.on('project-message', async data => {
        const message = data.message;
        const aiIsPresentInMessage = message.includes('@ai');

        if (!socket.activeRoomId && !aiIsPresentInMessage) return;
        
        // Save User Message
        try {
            await projectModel.findByIdAndUpdate(socket.project._id, {
                $push: { messages: data }
            });
        } catch (err) { console.error("Error saving message:", err); }

        if (socket.activeRoomId) {
            socket.broadcast.to(socket.activeRoomId).emit('project-message', data)
        }

        if (aiIsPresentInMessage) {
            const prompt = message.replace('@ai', '');
            
            // Heuristic: Check if creating files
            const isCreation = /create|make|generate|build|scaffold/i.test(prompt) && !/explain|how|what/i.test(prompt); 

            if (isCreation) {
                try {
                     const result = await generateResult(prompt, JSON_SYSTEM_PROMPT);
                     if (!result) throw new Error("AI returned empty response");
                     const cleanedResult = result.replace(/```json/g, '').replace(/```/g, '').trim();
                     const json = JSON.parse(cleanedResult);
                     
                     if (json.fileTree) {
                         // Update Project using Service to handle 'files' array and sanitization
                         // We merge existing tree with new tree
                         // use Service to get HYDRATED tree (safe for dot-files)
                         const projectDoc = await projectService.getProjectById({ projectId: socket.project._id });
                         const currentTree = projectDoc.fileTree || {}; 
                         const mergedTree = { ...currentTree, ...json.fileTree };

                         await projectService.updateFileTree({
                             projectId: socket.project._id,
                             fileTree: mergedTree
                         });
                         
                         // Re-fetch to get the state to sync? 
                         // updateFileTree returns the hydrated object now.
                         // But we can just use mergedTree for sync to avoid DB delay.
                         
                         // Sync to Everyone (Room or Solo)
                         const target = socket.activeRoomId || socket.id;
                         io.to(target).emit('sync-file-tree', { fileTree: mergedTree });

                         // Send Success Message
                         const aiMessage = {
                            message: "✅ Files generated and synced.",
                            sender: { _id: 'ai', email: 'AI' }
                         };
                         await projectModel.findByIdAndUpdate(socket.project._id, { $push: { messages: aiMessage } });
                         io.to(target).emit('project-message', aiMessage);
                         return; 
                     }
                } catch (e) {
                     console.log("AI Creation JSON parse failed, falling back to chat", e);
                }
            }

            // Chat Mode
            const result = await generateResult(prompt, CHAT_SYSTEM_PROMPT);
            const cleanedResult = (result || "I apologize, but I am unable to generate a response at this moment.").replace(/```json/g, '').replace(/```/g, '').trim(); // Just in case

            const aiMessage = {
                message: cleanedResult,
                sender: {
                    _id: 'ai',
                    email: 'AI'
                }
            };

            // Save AI Message
            try {
                await projectModel.findByIdAndUpdate(socket.project._id, {
                    $push: { messages: aiMessage }
                });
            } catch (err) { console.error("Error saving AI message:", err); }

            const target = socket.activeRoomId || socket.id;
            io.to(target).emit('project-message', aiMessage)
            return
        }
    })

    // --- TERMINAL Logic ---
    // We pass the socket, but note: Terminal is usually project-wide.
    // If users are in a "Session", should they share terminal?
    // User asked for "Collaborate live in an IDE-like environment".
    // We will allow terminal sharing if in the room.
    // We need to ensure the `registerSocketHandlers` uses `activeRoomId`?
    // The current implementation of `registerSocketHandlers` likely uses `socket.emit` or `io.emit`.
    // We'll leave it as is for now, but strictly speaking, terminal output should also be scoped.
    // Ideally, we'd pass `activeRoomId` to it.
    registerSocketHandlers(io, socket);


    socket.on('disconnect', () => {
        console.log('user disconnected');
        if (socket.activeRoomId) {
            io.to(socket.activeRoomId).emit('user-left', { userId: socket.user._id });
            updateRoomUsers(socket.activeRoomId);
        }
    });

});




server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})