import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: "15mb" }));

  // API endpoint for forging study materials
  app.post("/api/forge", async (req, res) => {
    try {
      const { content } = req.body;
      if (!content || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ error: "Content is required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is not configured in the environment settings." });
      }

      // Lazy initialize GoogleGenAI according to security / best practice guidelines
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Request study material transformation with strict structural guidance
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are an expert educational content generator. Your task is to analyze the user's input study material and forge three distinct study assets: Flashcards, Key Concepts, and Revision Cards.

CRITICAL PERFORMANCE RULES:
1. Be extremely concise. Avoid conversational filler, introductions, or conclusions. Start generating data immediately.
2. Limit the output size to prevent server processing timeouts. 
3. Generate exactly:
   - 5 high-impact Flashcards (Front/Back)
   - 5 core Key Concepts (Concept/Brief Summary)
   - 3 concise Revision Cards (Topic/Bullet-point breakdown)
4. Respond ONLY in valid, minified JSON format. Do not wrap the JSON in \`\`\`json markdown blocks. 

Output Structure:
{
  "flashcards": [{"front": "Question", "back": "Answer"}],
  "keyConcepts": [{"concept": "Name", "summary": "One sentence summary"}],
  "revisionCards": [{"topic": "Title", "points": ["Point 1", "Point 2"]}]
}

Input Study Material:
${content}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              flashcards: {
                type: "ARRAY",
                description: "List of exactly 5 high-impact flashcards with front/back keys.",
                items: {
                  type: "OBJECT",
                  properties: {
                    front: { type: "STRING" },
                    back: { type: "STRING" }
                  },
                  required: ["front", "back"]
                }
              },
              keyConcepts: {
                type: "ARRAY",
                description: "List of exactly 5 core key concepts.",
                items: {
                  type: "OBJECT",
                  properties: {
                    concept: { type: "STRING" },
                    summary: { type: "STRING" }
                  },
                  required: ["concept", "summary"]
                }
              },
              revisionCards: {
                type: "ARRAY",
                description: "List of exactly 3 concise revision cards.",
                items: {
                  type: "OBJECT",
                  properties: {
                    topic: { type: "STRING" },
                    points: {
                      type: "ARRAY",
                      items: { type: "STRING" }
                    }
                  },
                  required: ["topic", "points"]
                }
              }
            },
            required: ["flashcards", "keyConcepts", "revisionCards"]
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("Failed to generate content: empty response text.");
      }

      const parsed = JSON.parse(text);
      return res.json(parsed);

    } catch (error: any) {
      console.error("Gemini Core Processing Failure:", error);
      
      const errorMessage = error?.message || "";
      const isUnavailable = 
        error?.status === 503 || 
        error?.statusCode === 503 || 
        errorMessage.includes("503") || 
        errorMessage.toLowerCase().includes("service unavailable") ||
        errorMessage.toLowerCase().includes("overloaded") ||
        errorMessage.toLowerCase().includes("busy");

      if (isUnavailable) {
        return res.status(503).json({ error: "AI service is currently busy or experiencing high demand. Please try again." });
      }

      return res.status(500).json({ error: "Failed to parse or create study materials. Please verify your content format." });
    }
  });

  // Serve clients depending on current environment (Dev mode Vite vs Prod static dist)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[MindForge Server] Live and listening on host 0.0.0.0, port ${PORT}`);
  });
}

startServer();
