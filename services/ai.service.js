import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

// --- CONFIGURATION ---
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 1. Primary Models (Gemini) - Based on your "Working" list
const GEMINI_MODELS = [
    "gemini-2.0-flash",       // Often the fastest/standard (using 2.0 or 1.5 based on actual availability)
    "gemini-1.5-flash",       // Standard Fallback
    "gemini-flash-latest",    // User confirmed working
    "gemini-2.0-flash-lite-preview-02-05" // User confirmed working
];

// 2. Backup Model (Groq)
const GROQ_MODEL = "llama-3.1-8b-instant";

// 3. The Strict System Instruction (Prevents App Crashes)
// 3. The Strict System Instruction (Prevents App Crashes)
export const JSON_SYSTEM_PROMPT = `
You are an expert coding assistant with 10 years of experience.
CRITICAL: You must return the result in a specific JSON format only.
Do not speak in natural language. Do not add markdown like \`\`\`json.
Return ONLY the JSON object representing the file tree.

Example Format:
{
    "fileTree": {
        "app.js": { "file": { "contents": "const express = require('express');..." } },
        "package.json": { "file": { "contents": "..." } }
    },
    "buildCommand": { "mainItem": "npm", "commands": ["install"] },
    "startCommand": { "mainItem": "npm", "commands": ["start"] }
}
`;

export const CHAT_SYSTEM_PROMPT = `
You are an expert full-stack developer (React, Node, MERN).
Answer questions in a helpful, concise, and technical manner.
You can write code snippets in markdown.
Do NOT return a JSON object unless explicitly asked to generate a file structure.
`;

// --- HELPER: Gemini Generation ---
async function tryGemini(modelName, prompt, systemInstruction = JSON_SYSTEM_PROMPT) {
    try {
        const model = genAI.getGenerativeModel({
            model: modelName,
            model: modelName,
            systemInstruction: systemInstruction // Use provided or default
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.warn(`⚠️ Gemini (${modelName}) failed:`, error.message);
        return null; // Return null to trigger next attempt
    }
}

// --- HELPER: Groq Generation (Fallback) ---
async function tryGroq(prompt, systemInstruction = JSON_SYSTEM_PROMPT) {
    try {
        console.log("🔄 Switching to Groq Fallback...");
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: prompt }
            ],
            model: GROQ_MODEL,
            temperature: 0.5,
            max_tokens: 4096
        });
        return completion.choices[0]?.message?.content;
    } catch (error) {
        console.error("❌ Groq also failed:", error.message);
        return null; 
    }
}

// --- MAIN EXPORT FUNCTION ---
export const generateResult = async (prompt, systemInstruction = JSON_SYSTEM_PROMPT) => {

    // 1. Try Gemini Models in order
    for (const modelName of GEMINI_MODELS) {
        console.log(`🤖 Trying Gemini Model: ${modelName}...`);
        const result = await tryGemini(modelName, prompt, systemInstruction);
        if (result) {
            console.log(`✅ Success with ${modelName}`);
            return result;
        }
    }

    // 2. If all Gemini models fail, use Groq
    return await tryGroq(prompt, systemInstruction);
}