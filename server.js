import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import connect, { getDbStatus } from './db/db.js';
import redisClient from './services/redis.service.js';
import projectModel from './models/project.model.js';
import * as projectService from './services/project.service.js';
import { generateResult, JSON_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } from './services/ai.service.js';
import { registerSocketHandlers } from './services/socket.service.js';

const port = process.env.PORT || 3000;
const allowedOrigins = [
    'https://nviam-code.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
    ...(process.env.FRONTEND_URL ? [ process.env.FRONTEND_URL ] : []),
    ...(process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
        : [])
];
const normalizedAllowedOrigins = [ ...new Set(allowedOrigins) ];

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin(origin, callback) {
            if (!origin || normalizedAllowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error('Socket origin not allowed by CORS'));
        },
        credentials: true,
        methods: [ 'GET', 'POST' ]
    }
});

app.set('io', io);

io.use(async (socket, next) => {
    try {
        const dbStatus = getDbStatus();
        if (!dbStatus.ready) {
            return next(new Error('Database unavailable'));
        }

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
            return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded) {
            return next(new Error('Authentication error'));
        }

        socket.user = decoded;
        next();
    } catch (error) {
        next(error);
    }
});

io.on('connection', socket => {
    socket.roomId = socket.project._id.toString();

    socket.on('create-room', async ({ projectId }) => {
        if (!projectId || projectId !== socket.project._id.toString()) {
            return socket.emit('error', { message: 'Project mismatch' });
        }

        const roomId = Math.floor(100000 + Math.random() * 900000).toString();

        socket.join(roomId);
        socket.activeRoomId = roomId;

        socket.emit('room-created', { roomId });
    });

    socket.on('join-room', async ({ roomId }) => {
        const room = io.sockets.adapter.rooms.get(roomId);

        if (!room || room.size === 0) {
            return socket.emit('error', { message: 'Room not found or inactive' });
        }

        if (socket.activeRoomId) {
            socket.leave(socket.activeRoomId);
        }

        socket.join(roomId);
        socket.activeRoomId = roomId;

        socket.emit('room-joined', { roomId });

        io.to(roomId).emit('user-joined', {
            userId: socket.user._id,
            email: socket.user.email,
            socketId: socket.id
        });

        socket.to(roomId).emit('request-sync', { socketId: socket.id });
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

    socket.on('project-write', async data => {
        if (!socket.activeRoomId) return;
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
        io.to(socketId).emit('sync-file-tree', { fileTree });
    });

    socket.on('project-message', async data => {
        const message = data.message;
        const aiIsPresentInMessage = message.includes('@ai');

        if (!socket.activeRoomId && !aiIsPresentInMessage) return;

        try {
            await projectModel.findByIdAndUpdate(socket.project._id, {
                $push: { messages: data }
            });
        } catch (err) {
            console.error('Error saving message:', err);
        }

        if (socket.activeRoomId) {
            socket.broadcast.to(socket.activeRoomId).emit('project-message', data);
        }

        if (aiIsPresentInMessage) {
            const prompt = message.replace('@ai', '');
            const isCreation = /create|make|generate|build|scaffold/i.test(prompt) && !/explain|how|what/i.test(prompt);

            if (isCreation) {
                try {
                    const result = await generateResult(prompt, JSON_SYSTEM_PROMPT);
                    if (!result) throw new Error('AI returned empty response');
                    const cleanedResult = result.replace(/```json/g, '').replace(/```/g, '').trim();
                    const json = JSON.parse(cleanedResult);

                    if (json.fileTree) {
                        const projectDoc = await projectService.getProjectById({ projectId: socket.project._id });
                        const currentTree = projectDoc.fileTree || {};
                        const mergedTree = { ...currentTree, ...json.fileTree };

                        await projectService.updateFileTree({
                            projectId: socket.project._id,
                            fileTree: mergedTree
                        });

                        const target = socket.activeRoomId || socket.id;
                        io.to(target).emit('sync-file-tree', { fileTree: mergedTree });

                        const aiMessage = {
                            message: 'Files generated and synced.',
                            sender: { _id: 'ai', email: 'AI' }
                        };

                        await projectModel.findByIdAndUpdate(socket.project._id, { $push: { messages: aiMessage } });
                        io.to(target).emit('project-message', aiMessage);
                        return;
                    }
                } catch (error) {
                    console.log('AI creation JSON parse failed, falling back to chat', error);
                }
            }

            const result = await generateResult(prompt, CHAT_SYSTEM_PROMPT);
            const cleanedResult = (result || 'I apologize, but I am unable to generate a response at this moment.')
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();

            const aiMessage = {
                message: cleanedResult,
                sender: {
                    _id: 'ai',
                    email: 'AI'
                }
            };

            try {
                await projectModel.findByIdAndUpdate(socket.project._id, {
                    $push: { messages: aiMessage }
                });
            } catch (err) {
                console.error('Error saving AI message:', err);
            }

            const target = socket.activeRoomId || socket.id;
            io.to(target).emit('project-message', aiMessage);
        }
    });

    registerSocketHandlers(io, socket);

    socket.on('disconnect', () => {
        console.log('user disconnected');
        if (socket.activeRoomId) {
            io.to(socket.activeRoomId).emit('user-left', { userId: socket.user._id });
            updateRoomUsers(socket.activeRoomId);
        }
    });
});

async function startServer() {
    if (!process.env.JWT_SECRET) {
        throw new Error('Missing JWT_SECRET environment variable.');
    }

    if (typeof redisClient.connect === 'function') {
        try {
            await redisClient.connect();
        } catch (error) {
            console.error('Redis startup warning:', error.message);
        }
    }

    server.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });

    try {
        await connect();
    } catch (error) {
        console.error('Initial MongoDB connection failed. Server will stay up in degraded mode.', error);
    }
}

startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});
