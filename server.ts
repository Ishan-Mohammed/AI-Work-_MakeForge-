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
        contents: `You are an expert educational designer and academic tutor. Convert the following text/lesson notes into high-quality study materials.
Requirement:
1. Generate a minimum of 10 comprehensive flashcards covering a broad range of questions, depth, and detail. Give each card a sequential ID starting from "fc-1" up to "fc-x".
2. Extract all crucial key concepts and terminologies, mapping them to clear academic definitions and single-word contextual tags (e.g., "History", "Formula", "Definition", "Mechanism").
3. Create structured bullet-point revision modules in an easy-to-read pre-exam review style. Each topic should contain highly scannable bullet points detailing key facts, dates, theories, or formulas.

Source lesson notes / study materials:
${content}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              flashcards: {
                type: "ARRAY",
                description: "List of flashcards. Must contain at least 10 elements.",
                items: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING" },
                    question: { type: "STRING" },
                    answer: { type: "STRING" }
                  },
                  required: ["id", "question", "answer"]
                }
              },
              keyConcepts: {
                type: "ARRAY",
                description: "Array of extracted academic key concepts.",
                items: {
                  type: "OBJECT",
                  properties: {
                    concept: { type: "STRING" },
                    definition: { type: "STRING" },
                    tag: { type: "STRING" }
                  },
                  required: ["concept", "definition", "tag"]
                }
              },
              revisionCards: {
                type: "ARRAY",
                description: "Pre-exam high-yield revision cards summarizing topics in bullet point formats.",
                items: {
                  type: "OBJECT",
                  properties: {
                    topic: { type: "STRING" },
                    bullets: {
                      type: "ARRAY",
                      items: { type: "STRING" }
                    }
                  },
                  required: ["topic", "bullets"]
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
