import projectModel from '../models/project.model.js';
import * as projectService from '../services/project.service.js';
import userModel from '../models/user.model.js';
import { validationResult } from 'express-validator';

// Track running processes for code execution
const runningProcesses = new Map();

export const createProject = async (req, res) => {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        console.log("Validation Errors:", errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    try {

        const { name } = req.body;
        console.log("Create Project Request:", { name, user: req.user });

        const loggedInUser = await userModel.findOne({ email: req.user.email });

        if (!loggedInUser) {
            console.log("User not found in DB:", req.user.email);
            throw new Error("User not found");
        }

        const userId = loggedInUser._id;

        const newProject = await projectService.createProject({ name, userId });

        res.status(201).json(newProject);

    } catch (err) {
        console.log("Create Project Error:", err.message);
        res.status(400).send(err.message);
    }




}

export const importProject = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        console.log("Validation Errors:", errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { name, fileTree } = req.body;
        console.log("Import Project Request:", { name, user: req.user });

        const loggedInUser = await userModel.findOne({ email: req.user.email });

        if (!loggedInUser) {
            throw new Error("User not found");
        }

        const userId = loggedInUser._id;

        // 1. Create Project
        const newProject = await projectService.createProject({ name, userId });

        // 2. Update File Tree
        const updatedProject = await projectService.updateFileTree({
            projectId: newProject._id,
            fileTree: fileTree
        });

        res.status(201).json(updatedProject);

    } catch (err) {
        console.log("Import Project Error:", err.message);
        res.status(400).send(err.message);
    }
}

export const getAllProject = async (req, res) => {
    try {

        const loggedInUser = await userModel.findOne({
            email: req.user.email
        })

        const allUserProjects = await projectService.getAllProjectByUserId({
            userId: loggedInUser._id
        })

        return res.status(200).json({
            projects: allUserProjects
        })

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }
}

export const addUserToProject = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {

        const { projectId, users } = req.body

        const loggedInUser = await userModel.findOne({
            email: req.user.email
        })


        const project = await projectService.addUsersToProject({
            projectId,
            users,
            userId: loggedInUser._id
        })

        return res.status(200).json({
            project,
        })

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }


}

export const getProjectById = async (req, res) => {

    const { projectId } = req.params;

    try {

        const project = await projectService.getProjectById({ projectId });

        return res.status(200).json({
            project
        })

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }

}

export const updateFileTree = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {

        const { projectId } = req.params;
        const { fileTree } = req.body;

        const project = await projectService.updateFileTree({
            projectId,
            fileTree
        })

        return res.status(200).json({
            project
        })

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }

}

export const renameFile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { projectId, oldName, newName } = req.body;
        const project = await projectService.renameFile({ projectId, oldName, newName });
        return res.status(200).json({ project });
    } catch (err) {
        console.log(err);
        res.status(400).json({ error: err.message });
    }
}

export const deleteFile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { projectId, fileName } = req.body;
        const project = await projectService.deleteFile({ projectId, fileName });
        return res.status(200).json({ project });
    } catch (err) {
        console.log(err);
        res.status(400).json({ error: err.message });
    }
}

export const deleteProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        
        await projectService.deleteProject({ 
            projectId, 
            userId: loggedInUser._id 
        });

        return res.status(200).json({ message: "Project deleted successfully" });
    } catch (err) {
        console.log(err);
        res.status(400).json({ error: err.message });
    }
}

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RUNTIMES = {
    js: 'node',
    py: 'python', // Ensure python is in PATH
    java: 'javac',
    cpp: 'g++',
    c: 'gcc'
};

export const runProject = async (req, res) => {
    try {
        const { projectId, code, socketId, roomId } = req.body;
        const io = req.app.get('io');
        const platform = process.platform === 'win32' ? 'win' : 'unix';

        if (!projectId) {
            return res.status(400).json({ error: "Project ID is required" });
        }

        // Kill existing process
        if (runningProcesses[projectId]) {
            try {
                process.kill(runningProcesses[projectId].pid); // Ensure clean kill
                runningProcesses[projectId].kill();
            } catch (e) { /* ignore if already dead */ }
            delete runningProcesses[projectId];
        }

        const runId = uuidv4();
        const tempDir = path.join(__dirname, '..', 'temp', runId);

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Write files
        Object.keys(code).forEach(filename => {
            if (filename.includes('..') || filename.includes('\\') || filename.includes('/')) return;
            const content = code[filename].file.contents;
            const filePath = path.join(tempDir, filename);
            fs.writeFileSync(filePath, content);
        });

        // Detect Entry Point
        let entryFile = null;
        let extension = null;

        // 0. Use explicitly requested file if available and supported
        // req.body.runFile defaults to undefined
        if (req.body.runFile) {
            const ext = req.body.runFile.split('.').pop();
            if (RUNTIMES[ext] && code[req.body.runFile]) {
                entryFile = req.body.runFile;
                extension = ext;
            }
        }

        // 1. Fallback: Try finding based on priorities
        if (!entryFile) {
            const priorities = ['main', 'index', 'app', 'server'];
            for (const name of priorities) {
                for (const ext of Object.keys(RUNTIMES)) {
                    if (code[`${name}.${ext}`]) {
                        entryFile = `${name}.${ext}`;
                        extension = ext;
                        break;
                    }
                }
                if (entryFile) break;
            }
        }

        // 2. Fallback: Pick the first supported file
        if (!entryFile) {
            for (const filename of Object.keys(code)) {
                const ext = filename.split('.').pop();
                if (RUNTIMES[ext]) {
                    entryFile = filename;
                    extension = ext;
                    break;
                }
            }
        }

        if (!entryFile) {
            // Clean up
            fs.rm(tempDir, { recursive: true, force: true }, () => { });
            return res.status(400).json({ error: "No executable file found (js, py, java, cpp)" });
        }

        let cmd = RUNTIMES[extension];
        let args = [entryFile];
        let execCmd = null;
        let execArgs = [];

        // Compilation / Execution Logic
        if (extension === 'java') {
            // Java: javac File.java && java File
            // Note: class name must match file name, and 'java' runs the class (no extension)
            const className = entryFile.replace('.java', '');
            cmd = 'javac';
            args = [entryFile];
            execCmd = 'java';
            execArgs = [className];
        } else if (extension === 'cpp') {
            // C++: g++ file.cpp -o out && ./out
            const outName = platform === 'win' ? 'a.exe' : './a.out';
            cmd = 'g++';
            args = [entryFile, '-o', platform === 'win' ? 'a.exe' : 'a.out']; // On Windows looks for .exe
            execCmd = platform === 'win' ? path.join(tempDir, 'a.exe') : './a.out'; // Full path for Windows safety
            execArgs = [];
        } else if (extension === 'py') {
            cmd = 'python';
            args = ['-u', entryFile]; // -u for unbuffered output
        }

        const emitOutput = (data, isError = false) => {
            const output = data.toString();
            // FIXED: Broadcast to active room OR single socket
            const target = roomId || socketId;
            if(target) {
                io.to(target).emit('project-output', { 
                    output,
                    isError,
                    executedBy: req.user?.email || 'Unknown'
                });
            }
        };

        console.log(`Running ${entryFile} with ${cmd} ${args.join(' ')}`);

        // Notify all users that execution has started
        // Notify all users that execution has started
        const target = roomId || socketId;
        if (target) {
            io.to(target).emit('project-output', { 
                output: `▶ Execution started by ${req.user?.email || 'Unknown'}\n`,
                isStart: true,
                executedBy: req.user?.email || 'Unknown'
            });
        }

        // Spawn Process (Compiler or Runtime)
        // SECURITY: Add timeout to prevent infinite loops
        const child = spawn(cmd, args, { cwd: tempDir, shell: true, timeout: 15000 }); // 15s timeout
        runningProcesses[projectId] = child;

        child.stdout.on('data', emitOutput);

        // Stderr is tricky: for Java/C++, distinct compile errors from runtime errors
        child.stderr.on('data', emitOutput);

        child.on('close', (code) => {
            if (code === 0 && execCmd) {
                // Compilation Success -> Run Execution
                // Note: We used shell:true above, might need it here too or specific path
                emitOutput(`\nCompilation successful. Running...\n`);

                const runner = spawn(execCmd, execArgs, { cwd: tempDir, shell: true, timeout: 15000 }); // 15s timeout
                runningProcesses[projectId] = runner; // Update reference to runner

                runner.stdout.on('data', emitOutput);
                runner.stderr.on('data', emitOutput);

                runner.on('close', (runCode) => {
                    emitOutput(`\nExecution exited with code ${runCode}`);
                    delete runningProcesses[projectId];
                    fs.rm(tempDir, { recursive: true, force: true }, () => { });
                });

            } else {
                emitOutput(`\nProcess exited with code ${code}`);
                delete runningProcesses[projectId];
                fs.rm(tempDir, { recursive: true, force: true }, () => { });
            }
        });

        res.status(200).json({ message: "Process started", runId });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Server error during execution" });
    }
}