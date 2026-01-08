import os from 'os';
import pty from 'node-pty';

const terminals = {}; // { roomId: { terminalId: ptyProcess } }

export const registerSocketHandlers = (io, socket) => {
    const roomId = socket.roomId;

    // --- GENERIC RELAY FOR COLLAB ---
    // These events are just relayed to everyone else in the room
    const projectEvents = [
        'project-message', 
        'project-write', 
        'project-cursor-move', 
        'project-file-change',
        'create-room', // Actually logic needed? No, logic is in server.js usually, but relay for now
        'join-room',
        'leave-room',
        'sync-file-tree'
    ];

    projectEvents.forEach(event => {
        socket.on(event, (data) => {
            // Broadcast to everyone else in the room
            // Use activeRoomId if available (Collab Mode), otherwise default Project Room
            const target = socket.activeRoomId || socket.roomId;
            socket.to(target).emit(event, { 
                ...data, 
                socketId: socket.id 
            });
        });
    });



    // Initialize room terminals map if not exists
    if (!terminals[roomId]) {
        terminals[roomId] = {};
    }

    // Helper to spawn terminal
    const createTerminal = (termId) => {
        // Use 'bash' on Linux/Mac, 'powershell.exe' on Windows
        // Ideally checking os.platform()
        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

        const ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd: process.env.HOME || process.cwd(),
            env: process.env
        });

        terminals[roomId][termId] = ptyProcess;

        ptyProcess.on('data', (data) => {
            io.to(roomId).emit('terminal:data', {
                data,
                terminalId: termId
            });
        });

        // Cleanup on exit?
        ptyProcess.on('exit', () => {
            // Maybe notify frontend?
            // But let's stick to user request logic.
        });

        return ptyProcess;
    };

    // Handle Terminal Creation
    socket.on('terminal:create', (termId) => {
        // Create if not exists (or recreate/respawn)
        if (!terminals[roomId][termId]) {
            createTerminal(termId);
            // console.log(`Created terminal ${termId} for room ${roomId}`);
        }
    });

    // Handle Terminal Write
    socket.on('terminal:write', (data) => {
        // data: { terminalId, data }
        const { terminalId, data: input } = data;
        const ptyProcess = terminals[roomId][terminalId];
        if (ptyProcess) {
            ptyProcess.write(input);
        }
    });

    // Handle Terminal Kill
    socket.on('terminal:kill', (termId) => {
        const ptyProcess = terminals[roomId][termId];
        if (ptyProcess) {
            ptyProcess.kill();
            delete terminals[roomId][termId];
            // console.log(`Killed terminal ${termId} in room ${roomId}`);
        }
    });

    // Handle Terminal Resize
    socket.on('terminal:resize', ({ terminalId, cols, rows }) => {
        const ptyProcess = terminals[roomId][terminalId];
        if (ptyProcess) {
            ptyProcess.resize(cols, rows);
        }
    });
};
