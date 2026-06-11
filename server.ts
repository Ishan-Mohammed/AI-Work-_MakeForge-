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

      // Secure API key configuration using primary GEMINI_API_KEY or fallback GOOGLE_API_KEY
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
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

      let response;
      let lastError: any = null;
      const retryDelays = [2000, 4000, 8000];
      const maxRetries = 3;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          response = await ai.models.generateContent({
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
          
          // Successful response obtained, exit retry loop
          break;
        } catch (error: any) {
          lastError = error;
          const status = error?.status || error?.statusCode || 500;
          const message = error?.message || "";
          
          console.error(`Attempt ${attempt + 1}/${maxRetries + 1} failed. HTTP Status: ${status}. Error details: ${message}`);

          const isAuthError =
            status === 401 ||
            message.includes("401") ||
            message.toLowerCase().includes("unauthorized") ||
            message.toLowerCase().includes("invalid api key") ||
            message.toLowerCase().includes("api key not valid");

          const isRateLimitOrOverloaded =
            status === 429 ||
            status === 503 ||
            message.includes("429") ||
            message.includes("503") ||
            message.toLowerCase().includes("overloaded") ||
            message.toLowerCase().includes("rate limit") ||
            message.toLowerCase().includes("service unavailable") ||
            message.toLowerCase().includes("quota");

          if (isAuthError) {
            console.error("Authentication (401) Error: Unauthorized access. The API key is invalid or not authorized on this model.");
            break; // Stop immediately since retrying won't change auth credentials
          }

          if (isRateLimitOrOverloaded) {
            console.warn(`Encountered high demand/rate limit (Status ${status}) on retry attempt ${attempt + 1}.`);
          }

          if (attempt < maxRetries) {
            const nextDelay = retryDelays[attempt];
            console.log(`Retrying after ${nextDelay}ms delay...`);
            await new Promise(resolve => setTimeout(resolve, nextDelay));
          } else {
            console.error("Maximum retry attempts exceeded for generating study materials.");
          }
        }
      }

      if (!response) {
        throw lastError || new Error("Failed to generate content after all retry attempts.");
      }

      const text = response.text;
      if (!text) {
        throw new Error("Failed to generate content: empty response text.");
      }

      const parsed = JSON.parse(text);
      return res.json(parsed);

    } catch (error: any) {
      console.error("Gemini Core Processing Failure:", error);
      
      const status = error?.status || error?.statusCode || 500;
      const errorMessage = error?.message || "";

      const isAuthError =
        status === 401 ||
        errorMessage.includes("401") ||
        errorMessage.toLowerCase().includes("unauthorized") ||
        errorMessage.toLowerCase().includes("api key");

      const isRateLimited =
        status === 429 ||
        errorMessage.includes("429") ||
        errorMessage.toLowerCase().includes("quota") ||
        errorMessage.toLowerCase().includes("rate limit");

      const isUnavailable =
        status === 503 ||
        errorMessage.includes("503") ||
        errorMessage.toLowerCase().includes("service unavailable") ||
        errorMessage.toLowerCase().includes("overloaded") ||
        errorMessage.toLowerCase().includes("busy");

      if (isAuthError) {
        console.error("Descriptive Server Log (401 Unauthorized Error): The provided credentials are invalid or expired. Check process.env.GEMINI_API_KEY or process.env.GOOGLE_API_KEY.");
        return res.status(401).json({ error: "Unauthorized: Invalid or missing API key." });
      }

      if (isRateLimited) {
        console.error("Descriptive Server Log (429 Rate Limit Error): The application is exceeding current API usage limits.");
        return res.status(429).json({ error: "Rate limit exceeded. Please try again shortly." });
      }

      if (isUnavailable) {
        console.error("Descriptive Server Log (503 Service Unavailable / Overload Error): Gemini or upstream service is busy or overloaded.");
        return res.status(503).json({ error: "AI service is currently busy or overloaded. Please try again in a moment." });
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
