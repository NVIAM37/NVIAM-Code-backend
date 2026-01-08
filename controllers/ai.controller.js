import * as ai from '../services/ai.service.js';

export const getResult = async (req, res) => {
    try {
        const { prompt } = req.query;
        
        // Use a conversational prompt for chat mode
        const chatSystemInstruction = `
You are a friendly AI coding mentor and tutor.
- Be conversational and helpful
- Answer coding questions clearly and concisely
- Use plain text, NOT JSON
- Be encouraging and supportive
- If asked to generate a project, THEN return the fileTree JSON format, otherwise just chat normally
        `.trim();
        
        const result = await ai.generateResult(prompt, chatSystemInstruction);
        
        // Try to parse as JSON to extract text field if it exists
        try {
            const parsed = JSON.parse(result);
            if (parsed.text) {
                return res.send(parsed.text);
            }
        } catch (e) {
            // If not JSON, send as is
        }
        
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
}

export const generateResult = async (req, res) => {
    try {
        const { prompt, context, type } = req.body;

        if (!prompt) return res.status(400).send({ message: "Prompt is required" });

        let finalPrompt = prompt;
        let systemInstruction = "";

        if (context) {
            finalPrompt = `${prompt}\n\nContext Code:\n${context}`;
        }

        if (type === 'fix') {
            systemInstruction = `
You are a friendly coding tutor.
1. If the user says "Hello", just say "Hello! Ready to code?".
2. Do NOT generate files unless explicitly asked.
3. Be short and helpful.
4. CRITICAL: You must return the result as a JSON object with a "text" field containing the explanation and a "fixedCode" field containing the corrected code snippet.
Do not wrap the JSON in markdown blocks. Return ONLY the JSON string.
            `;
        } else if (type === 'explain' || !type) { // Default to explanation/chat
            systemInstruction = `
You are a friendly coding tutor.
1. If user says "Hello", say "Hello! Ready to code?".
2. CRITICAL: Return a JSON object: { "text": "explanation...", "code": "code snippet or null" }
3. Return ONLY valid JSON.
            `;
        }

        const result = await ai.generateResult(finalPrompt, systemInstruction);
        const cleanedResult = result.replace(/```json/g, '').replace(/```/g, '').trim();

        res.send(cleanedResult);

    } catch (error) {
        console.error(error);
        
        if (error.message.includes('429') || error.message.includes('Quota exceeded')) {
             return res.send("⚠️ AI Brain Overloaded (Quota Exceeded). logical circuits are cooling down. Please try again in a minute.");
        }
        
        res.status(500).send({ message: error.message });
    }
}