import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_KEY;
const groqApiKey = process.env.GROQ_API_KEY;

const genAI = googleApiKey ? new GoogleGenerativeAI(googleApiKey) : null;
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

const GEMINI_MODELS = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-flash-latest',
    'gemini-2.0-flash-lite-preview-02-05'
];

const GROQ_MODEL = 'llama-3.1-8b-instant';

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

async function tryGemini(modelName, prompt, systemInstruction = JSON_SYSTEM_PROMPT) {
    if (!genAI) {
        return null;
    }

    try {
        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.warn(`Gemini (${modelName}) failed:`, error.message);
        return null;
    }
}

async function tryGroq(prompt, systemInstruction = JSON_SYSTEM_PROMPT) {
    if (!groq) {
        return null;
    }

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: prompt }
            ],
            model: GROQ_MODEL,
            temperature: 0.5,
            max_tokens: 4096
        });

        return completion.choices[0]?.message?.content;
    } catch (error) {
        console.error('Groq failed:', error.message);
        return null;
    }
}

export const generateResult = async (prompt, systemInstruction = JSON_SYSTEM_PROMPT) => {
    for (const modelName of GEMINI_MODELS) {
        const result = await tryGemini(modelName, prompt, systemInstruction);
        if (result) {
            return result;
        }
    }

    const fallbackResult = await tryGroq(prompt, systemInstruction);
    if (fallbackResult) {
        return fallbackResult;
    }

    throw new Error('AI service is not configured. Set GOOGLE_API_KEY/GOOGLE_AI_KEY or GROQ_API_KEY.');
};
