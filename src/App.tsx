import React, { useState, useEffect, useRef } from "react";
import { 
  Brain, 
  Upload, 
  FileText, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Copy, 
  Check, 
  Download, 
  BookOpen, 
  Layers, 
  Lightbulb, 
  AlertCircle, 
  Trash2, 
  ArrowRight,
  Eye,
  EyeOff
} from "lucide-react";
import Navbar from "./components/Navbar";
import { extractTextFromFile } from "./utils/fileParser";
import { StudyMaterial, ProcessingStep, Flashcard, KeyConcept, RevisionCard } from "./types";

export default function App() {
  // Dark mode state
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme) return savedTheme === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  // Material state
  const [inputText, setInputText] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [characterCount, setCharacterCount] = useState<number>(0);

  // Forging states
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("idle");
  const [currentProgressText, setCurrentProgressText] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [copiedState, setCopiedState] = useState<{ [key: string]: boolean }>({});

  // Generated materials
  const [studyMaterial, setStudyMaterial] = useState<StudyMaterial | null>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("forged_material");
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (_) {
          return null;
        }
      }
    }
    return null;
  });

  // Active sub-views & interactive selections
  const [activeTab, setActiveTab] = useState<"flashcards" | "concepts" | "revision">("flashcards");
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState<number>(0);
  const [isCardFlipped, setIsCardFlipped] = useState<boolean>(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("All");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync dark theme class
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  // Update char counter
  useEffect(() => {
    setCharacterCount(inputText.length);
  }, [inputText]);

  // Handle dark mode toggling
  const toggleDark = () => {
    setIsDark(!isDark);
  };

  // Drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processSelectedFile(files[0]);
    }
  };

  // File picker handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processSelectedFile(files[0]);
    }
  };

  const processSelectedFile = async (file: File) => {
    try {
      setProcessingStep("reading");
      setCurrentProgressText("Reading content...");
      const text = await extractTextFromFile(file);
      
      if (!text || !text.trim()) {
        throw new Error("The selected file contains empty or unreadable text content.");
      }
      
      setInputText(text);
      setUploadedFileName(file.name);
      setProcessingStep("idle");
    } catch (err: any) {
      setProcessingStep("failed");
      setErrorMessage(err.message || "Failed to parse study material file. Please try pasting coordinates manually.");
      setTimeout(() => {
        setProcessingStep("idle");
      }, 5000);
    }
  };

  const clearFile = () => {
    setUploadedFileName("");
    setInputText("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Simulated live progress sequence to keep user feeling high speed
  const runProgressSequence = (cancelRef: { current: boolean }) => {
    const steps = [
      { text: "Reading content...", delay: 0 },
      { text: "Extracting concepts...", delay: 1200 },
      { text: "Generating flashcards...", delay: 2800 },
      { text: "Creating revision cards...", delay: 4500 }
    ];

    steps.forEach((s) => {
      setTimeout(() => {
        if (!cancelRef.current) {
          setCurrentProgressText(s.text);
        }
      }, s.delay);
    });
  };

  // Perform backend AI Forging with Client-Side Retry Logic
  const forgeStudyMaterial = async () => {
    if (!inputText.trim()) return;

    setErrorMessage("");
    setProcessingStep("reading");
    
    const cancelProgress = { current: false };
    runProgressSequence(cancelProgress);

    const maxRetries = 3;
    const retryDelays = [2000, 4000, 8000]; // 2s, 4s, 8s

    const attemptFetch = async (attempt: number): Promise<StudyMaterial> => {
      const response = await fetch("/api/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: inputText })
      });

      if (response.status === 503) {
        throw { status: 503, message: "AI service is experiencing high demand. Retrying..." };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw { status: response.status, message: errorData.error || "Server processing issue." };
      }

      return await response.json();
    };

    for (let i = 0; i <= maxRetries; i++) {
      try {
        const result = await attemptFetch(i);
        
        // Success
        cancelProgress.current = true;
        setStudyMaterial(result);
        localStorage.setItem("forged_material", JSON.stringify(result));
        
        // Reset subviews
        setCurrentFlashcardIndex(0);
        setIsCardFlipped(false);
        setSelectedTagFilter("All");
        setProcessingStep("completed");
        
        // Auto navigate to top of presentation
        const resultsEl = document.getElementById("forge-results");
        if (resultsEl) {
          resultsEl.scrollIntoView({ behavior: "smooth" });
        }
        return;
      } catch (err: any) {
        if (err.status === 503 && i < maxRetries) {
          cancelProgress.current = true;
          setProcessingStep("retrying");
          setCurrentProgressText(`AI service is experiencing high demand. Retrying in ${retryDelays[i] / 1000}s...`);
          await new Promise((r) => setTimeout(r, retryDelays[i]));
          
          // Re-trigger visual sequence for subsequent retry
          cancelProgress.current = false;
          runProgressSequence(cancelProgress);
        } else {
          // Final crash or unrecoverable error
          cancelProgress.current = true;
          setProcessingStep("failed");
          if (err.status === 503) {
            setErrorMessage("AI service is currently busy. Please try again in a few moments.");
          } else {
            setErrorMessage(err.message || "An error occurred while generating. Please try again.");
          }
          return;
        }
      }
    }
  };

  // Clipboard copy utilities
  const handleCopyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedState(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedState(prev => ({ ...prev, [id]: false }));
    }, 2000);
  };

  // Download section data as TXT
  const downloadAsTxt = (section: "flashcards" | "concepts" | "revision" | "all") => {
    if (!studyMaterial) return;

    let content = `=== MINDFORGE AI STUDY WORKSPACE ===\nGenerated at: ${new Date().toLocaleDateString()}\n\n`;

    if (section === "flashcards" || section === "all") {
      content += `--- FLASHCARDS ---\n`;
      studyMaterial.flashcards.forEach((fc, idx) => {
        content += `${idx + 1}. Q: ${fc.front}\n   A: ${fc.back}\n\n`;
      });
    }

    if (section === "concepts" || section === "all") {
      content += `--- KEY CONCEPTS ---\n`;
      studyMaterial.keyConcepts.forEach((kc) => {
        content += `Concept: ${kc.concept}\nSummary: ${kc.summary}\n\n`;
      });
    }

    if (section === "revision" || section === "all") {
      content += `--- REVISION MODULES ---\n`;
      studyMaterial.revisionCards.forEach((rc) => {
        content += `Topic: ${rc.topic}\n`;
        rc.points.forEach((point) => {
          content += `• ${point}\n`;
        });
        content += `\n`;
      });
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `MindForge_Study_${section}_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Download section data as JSON
  const downloadAsJson = (section: "flashcards" | "concepts" | "revision" | "all") => {
    if (!studyMaterial) return;

    let exportData: any = studyMaterial;
    if (section !== "all") {
      exportData = { [section]: studyMaterial[section] };
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `MindForge_Material_${section}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Clean active forged study materials
  const resetWorkspace = () => {
    if (window.confirm("Are you sure you want to clear your current generated study materials?")) {
      setStudyMaterial(null);
      localStorage.removeItem("forged_material");
      setCurrentFlashcardIndex(0);
      setIsCardFlipped(false);
    }
  };

  // Concept mapping logic
  const filteredConcepts = studyMaterial ? studyMaterial.keyConcepts : [];

  return (
    <div className="min-h-screen bg-[#faf9f6] text-stone-800 dark:bg-zinc-950 dark:text-zinc-100 transition-colors duration-300 grid-overlay pb-16">
      
      {/* Premium Minimal Navigation */}
      <Navbar isDark={isDark} toggleDark={toggleDark} />

      <main className="mx-auto max-w-4xl px-4 pt-10 sm:px-6 lg:px-8">
        
        {/* TOP SECTION with strict entrance animations */}
        <header className="mb-12 text-center text-balance">
          <div className="inline-flex items-center space-x-2 rounded-full border border-teal-500/10 bg-teal-50/50 px-3 py-1 text-sm font-semibold text-teal-700 dark:border-teal-500/20 dark:bg-teal-950/40 dark:text-teal-400 mb-4 animate-fade-up-delayed">
            <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
            <span className="font-display">MindForge AI Engine Active</span>
          </div>

          <h1 
            id="main-heading" 
            className="animate-slide-fade-left font-display text-4xl font-extrabold tracking-tight text-stone-900 sm:text-5xl dark:text-zinc-50"
          >
            MindForge <span className="bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent dark:from-teal-400 dark:to-emerald-400">AI</span>
          </h1>

          <p 
            id="subheading" 
            className="animate-fade-up-delayed mt-4 text-base leading-relaxed text-stone-600 sm:text-lg dark:text-zinc-400 max-w-2xl mx-auto"
          >
            Transform your notes, lessons, and study materials into AI-powered flashcards, key concepts, and revision cards in seconds.
          </p>
        </header>

        {/* INPUT SECTION */}
        <section className="rounded-2xl border border-stone-200/80 bg-white/60 p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60 backdrop-blur-md transition-all duration-300 mb-10">
          
          <div className="mb-4 flex items-center justify-between">
            <label className="font-display font-semibold text-stone-800 dark:text-zinc-200 flex items-center gap-2">
              <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              Source Material
            </label>
            <div className="text-xs text-stone-500 dark:text-zinc-400 font-mono">
              {characterCount.toLocaleString()} characters
            </div>
          </div>

          {/* DRAG AND DROP ZONE */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative rounded-xl border-2 border-dashed transition-all duration-200 p-4 ${
              isDragging 
                ? "border-teal-500 bg-teal-50/20 dark:bg-teal-950/10 scale-[1.01] shadow-inner" 
                : "border-stone-200 hover:border-stone-300 dark:border-zinc-800 dark:hover:border-zinc-700 bg-stone-50/50 dark:bg-zinc-950/20"
            }`}
          >
            {/* Reduced height text-area for better visual balance */}
            <textarea
              id="source-content"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your lesson content or drop a lecture PDF, DOCX, or TXT file here..."
              className="w-full h-40 bg-transparent text-stone-800 dark:text-zinc-100 placeholder-stone-400 dark:placeholder-zinc-500 border-none outline-none focus:ring-0 resize-none text-base leading-relaxed"
            />

            {/* Custom file control trigger state overlay if file loaded */}
            {uploadedFileName && (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-stone-100/90 dark:bg-zinc-900/90 border-t border-stone-200 dark:border-zinc-800 px-4 py-2 rounded-b-xl animate-fade-in">
                <div className="flex items-center space-x-2 text-stone-700 dark:text-zinc-300 text-sm font-medium">
                  <FileText className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <span className="truncate max-w-xs">{uploadedFileName}</span>
                </div>
                <button
                  onClick={clearFile}
                  className="flex items-center space-x-1 text-xs text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 font-semibold cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remove</span>
                </button>
              </div>
            )}
          </div>

          {/* Upload Selector Helper */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-stone-100 dark:border-zinc-800/80 pt-4">
            <div className="flex items-center space-x-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileChange}
                className="hidden"
                id="file-selector"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all duration-200 cursor-pointer"
              >
                <Upload className="h-4 w-4 text-stone-500 dark:text-zinc-400" />
                <span>Upload Lesson Document</span>
              </button>
              <span className="text-xs text-stone-400 dark:text-zinc-500 hidden md:inline font-medium">
                Supports PDF, DOCX, TXT
              </span>
            </div>

            {/* Forge Button with Prompt Loading state */}
            <button
              id="forge-button"
              disabled={!inputText.trim() || processingStep !== "idle"}
              onClick={forgeStudyMaterial}
              className={`w-full sm:w-auto relative flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 dark:from-teal-500 dark:to-emerald-500 px-6 py-3 font-display font-bold text-stone-50 shadow-md shadow-teal-500/10 cursor-pointer transition-all duration-300 scale-button ${
                (!inputText.trim() || processingStep !== "idle") ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <Brain className="h-5 w-5" />
              <span>Forge Study Material</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* AI PROCESSING & LOADING INDICATOR OVERLAY */}
        {processingStep !== "idle" && processingStep !== "completed" && (
          <div className="rounded-2xl border border-teal-100 bg-teal-50/20 p-8 shadow-sm dark:border-teal-950/40 dark:bg-teal-950/10 backdrop-blur-md mb-10 transition-all duration-300">
            {processingStep === "failed" ? (
              <div className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500 dark:bg-rose-950/30 dark:text-rose-400">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display font-bold text-rose-800 dark:text-rose-400 text-lg">
                  Forging Interrupted
                </h3>
                <p className="mt-2 text-stone-600 dark:text-zinc-400 text-sm max-w-md">
                  {errorMessage || "AI service is currently busy. Please try again in a few moments."}
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => {
                      setProcessingStep("idle");
                      setErrorMessage("");
                    }}
                    className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                  >
                    Adjust Content
                  </button>
                  <button
                    onClick={forgeStudyMaterial}
                    className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 transition-all cursor-pointer"
                  >
                    Retry Forging
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600/15 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400">
                  <RefreshCw className="h-7 w-7 animate-spin duration-3000" />
                </div>
                
                <h3 className="mt-5 font-display font-bold text-stone-800 dark:text-zinc-100 text-lg">
                  Generating Study Assets
                </h3>
                
                <p className="mt-2 text-stone-500 dark:text-zinc-400 text-sm font-mono tracking-wide">
                  {currentProgressText}
                </p>

                {/* Simulated dynamic progress pipeline */}
                <div className="mt-6 w-full max-w-xs bg-stone-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-1000"
                    style={{
                      width: 
                        processingStep === "reading" ? "25%" :
                        processingStep === "extracting" ? "50%" :
                        processingStep === "flashcards" ? "75%" :
                        processingStep === "revision" ? "90%" : 
                        processingStep === "retrying" ? "15%" : "10%"
                    }}
                  />
                </div>

                {processingStep === "retrying" && (
                  <div className="mt-4 inline-flex items-center space-x-2 text-amber-500 text-xs font-semibold uppercase tracking-wider bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/10 dark:bg-amber-950/20 dark:border-amber-500/20">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>AI Overload Auto-Recovery Mode</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STUDY RESULT DISPLAY AREAS */}
        {studyMaterial && (
          <div id="forge-results" className="scroll-mt-20">
            
            {/* View navigation headers */}
            <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-stone-200 dark:border-zinc-800 pb-4 gap-4">
              <div className="flex bg-stone-100 dark:bg-zinc-900 rounded-lg p-1 space-x-1">
                <button
                  onClick={() => setActiveTab("flashcards")}
                  className={`flex items-center space-x-2 rounded-md px-4 py-2 font-display text-sm font-bold transition-all cursor-pointer ${
                    activeTab === "flashcards"
                      ? "bg-white text-teal-700 shadow-sm dark:bg-zinc-800 dark:text-teal-400"
                      : "text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100"
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  <span>Flashcards ({studyMaterial.flashcards.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab("concepts")}
                  className={`flex items-center space-x-2 rounded-md px-4 py-2 font-display text-sm font-bold transition-all cursor-pointer ${
                    activeTab === "concepts"
                      ? "bg-white text-teal-700 shadow-sm dark:bg-zinc-800 dark:text-teal-400"
                      : "text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100"
                  }`}
                >
                  <Lightbulb className="h-4 w-4" />
                  <span>Key Concepts ({studyMaterial.keyConcepts.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab("revision")}
                  className={`flex items-center space-x-2 rounded-md px-4 py-2 font-display text-sm font-bold transition-all cursor-pointer ${
                    activeTab === "revision"
                      ? "bg-white text-teal-700 shadow-sm dark:bg-zinc-800 dark:text-teal-400"
                      : "text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100"
                  }`}
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Revision Cards ({studyMaterial.revisionCards.length})</span>
                </button>
              </div>

              {/* Reset Control */}
              <button
                onClick={resetWorkspace}
                className="flex items-center justify-center space-x-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 text-stone-500 hover:text-rose-500 dark:text-zinc-400 dark:hover:text-rose-400 text-xs font-semibold px-3 py-2 cursor-pointer transition-all transition-colors duration-150"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear Workspace</span>
              </button>
            </div>

            {/* TAB CONTENT 1: INTERACTIVE FLASHCARDS */}
            {activeTab === "flashcards" && (
              <div className="space-y-6">
                
                {/* Section Action Panel */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-xl font-bold text-stone-900 dark:text-zinc-50">
                      Mastery Flashcards
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
                      Click current card to flip or use arrow buttons to navigate.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleCopyToClipboard(
                        `Question: ${studyMaterial.flashcards[currentFlashcardIndex].front}\nAnswer: ${studyMaterial.flashcards[currentFlashcardIndex].back}`,
                        "fc-single"
                      )}
                      className="flex h-9 items-center space-x-1 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                      title="Copy current flashcard to clipboard"
                    >
                      {copiedState["fc-single"] ? <Check className="h-3.5 w-3.5 text-teal-600" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedState["fc-single"] ? "Copied" : "Copy Card"}</span>
                    </button>

                    <button
                      onClick={() => downloadAsTxt("flashcards")}
                      className="flex h-9 items-center space-x-1 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                      title="Download as text file"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>TXT</span>
                    </button>

                    <button
                      onClick={() => downloadAsJson("flashcards")}
                      className="flex h-9 items-center space-x-1 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                      title="Download JSON structure"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>JSON</span>
                    </button>
                  </div>
                </div>

                {/* 3D PERSPECTIVE FLIP CARD VIEW */}
                <div className="flex flex-col items-center">
                  <div 
                    onClick={() => setIsCardFlipped(!isCardFlipped)}
                    className="w-full max-w-lg h-72 perspective-1000 cursor-pointer group"
                  >
                    <div className={`relative w-full h-full duration-500 preserve-3d transition-transform ${isCardFlipped ? "rotate-y-180" : ""}`}>
                      
                      {/* FRONT CARD (Question Side) */}
                      <div className="absolute inset-0 w-full h-full rounded-2xl border border-stone-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-8 flex flex-col justify-between shadow-md backface-hidden">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center space-x-1 text-xs font-mono font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full">
                            <span>Question</span>
                          </span>
                          <span className="text-xs text-stone-400 font-mono font-bold">
                            {currentFlashcardIndex + 1} / {studyMaterial.flashcards.length}
                          </span>
                        </div>
                        
                        <div className="my-auto text-center font-display text-lg sm:text-xl font-bold leading-relaxed text-stone-800 dark:text-zinc-50 px-2 select-none">
                          {studyMaterial.flashcards[currentFlashcardIndex]?.front}
                        </div>

                        <div className="text-center text-xs text-stone-400 dark:text-zinc-500 font-medium">
                          Click card to flip and view the verified answer
                        </div>
                      </div>

                      {/* BACK CARD (Answer Side) */}
                      <div className="absolute inset-0 w-full h-full rounded-2xl border border-stone-200 dark:border-zinc-800/80 bg-zinc-900 dark:bg-[#111113] p-8 flex flex-col justify-between shadow-md rotate-y-180 backface-hidden">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center space-x-1 text-xs font-mono font-bold uppercase tracking-wider text-emerald-500 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                            <span>Answer</span>
                          </span>
                          <span className="text-xs text-stone-400 font-mono font-bold">
                            {currentFlashcardIndex + 1} / {studyMaterial.flashcards.length}
                          </span>
                        </div>

                        <div className="my-auto text-center text-base sm:text-lg leading-relaxed text-zinc-100 dark:text-zinc-200 px-2 select-none">
                          {studyMaterial.flashcards[currentFlashcardIndex]?.back}
                        </div>

                        <div className="text-center text-xs text-stone-500 dark:text-stone-400 font-medium">
                          Click card to flip back to question content
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Navigation Row */}
                  <div className="mt-6 flex items-center justify-center space-x-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCardFlipped(false);
                        setTimeout(() => {
                          setCurrentFlashcardIndex((prev) => (prev > 0 ? prev - 1 : studyMaterial.flashcards.length - 1));
                        }, 120);
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 shadow-sm cursor-pointer transition-all"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    <span className="text-sm font-mono font-bold text-stone-500 dark:text-zinc-400">
                      Card {currentFlashcardIndex + 1} of {studyMaterial.flashcards.length}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCardFlipped(false);
                        setTimeout(() => {
                          setCurrentFlashcardIndex((prev) => (prev < studyMaterial.flashcards.length - 1 ? prev + 1 : 0));
                        }, 120);
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 shadow-sm cursor-pointer transition-all"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Bulk View Table / Deck Overview Grid Map */}
                <div className="border-t border-stone-200/80 dark:border-zinc-800/80 pt-6 mt-8">
                  <h3 className="font-display font-bold text-stone-800 dark:text-zinc-200 text-sm mb-3">
                    Knowledge Deck Map
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {studyMaterial.flashcards.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setIsCardFlipped(false);
                          setCurrentFlashcardIndex(idx);
                        }}
                        className={`font-mono text-xs font-bold leading-none h-8 w-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                          currentFlashcardIndex === idx
                            ? "bg-teal-600 text-white dark:bg-teal-500"
                            : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* TAB CONTENT 2: KEY CONCEPTS MAP */}
            {activeTab === "concepts" && (
              <div className="space-y-6">
                
                {/* Section Action Panel */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-bold text-stone-900 dark:text-zinc-50">
                      Extracted Academic Concepts
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
                      Key academic concepts and descriptions extracted by MindForge AI.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => {
                        const compiled = studyMaterial.keyConcepts.map(c => `${c.concept}: ${c.summary}`).join("\n\n");
                        handleCopyToClipboard(compiled, "concepts-all");
                      }}
                      className="flex h-9 items-center space-x-1 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                    >
                      {copiedState["concepts-all"] ? <Check className="h-3.5 w-3.5 text-teal-600" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedState["concepts-all"] ? "Copied All" : "Copy All"}</span>
                    </button>

                    <button
                      onClick={() => downloadAsTxt("concepts")}
                      className="flex h-9 items-center space-x-1 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>TXT</span>
                    </button>

                    <button
                      onClick={() => downloadAsJson("concepts")}
                      className="flex h-9 items-center space-x-1 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>JSON</span>
                    </button>
                  </div>
                </div>

                {/* Concepts cards container */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredConcepts.map((item, index) => (
                    <div 
                      key={index}
                      className="group rounded-xl border border-stone-200/80 bg-white p-5 shadow-sm hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-900/40 hover:border-teal-500/30 dark:hover:border-teal-500/40 transition-all duration-200 flex flex-col justify-between"
                    >
                      <div>
                        {/* Concept Top Header */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-mono font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            Concept {index + 1}
                          </span>
                          <button
                            onClick={() => handleCopyToClipboard(`${item.concept}: ${item.summary}`, `concept-${index}`)}
                            className="text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                            title="Copy concept card"
                          >
                            {copiedState[`concept-${index}`] ? (
                              <Check className="h-3.5 w-3.5 text-teal-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Title concept */}
                        <h3 className="font-display font-extrabold text-stone-950 dark:text-zinc-50 text-base mb-2">
                          {item.concept}
                        </h3>

                        {/* Brief summary */}
                        <p className="text-stone-600 dark:text-zinc-300 text-sm leading-relaxed">
                          {item.summary}
                        </p>
                      </div>
                    </div>
                  ))}

                  {filteredConcepts.length === 0 && (
                    <div className="col-span-2 text-center py-10 bg-stone-50 dark:bg-zinc-900/20 rounded-xl border border-dashed border-stone-200 dark:border-zinc-800">
                      <p className="text-sm text-stone-500 dark:text-zinc-400">
                        No concepts successfully extracted.
                      </p>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB CONTENT 3: REVISION CARDS SHEET */}
            {activeTab === "revision" && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Section header action */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-xl font-bold text-stone-900 dark:text-zinc-50">
                      Active Revision Cards
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
                      High-yield study summaries organized by core topics.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        const compiled = studyMaterial.revisionCards.map(r => `Topic: ${r.topic}\n` + r.points.map(p => `• ${p}`).join("\n")).join("\n\n");
                        handleCopyToClipboard(compiled, "revision-all");
                      }}
                      className="flex h-9 items-center space-x-1 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                    >
                      {copiedState["revision-all"] ? <Check className="h-3.5 w-3.5 text-teal-600" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedState["revision-all"] ? "Copied All" : "Copy All"}</span>
                    </button>

                    <button
                      onClick={() => downloadAsTxt("revision")}
                      className="flex h-9 items-center space-x-1 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>TXT</span>
                    </button>

                    <button
                      onClick={() => downloadAsJson("revision")}
                      className="flex h-9 items-center space-x-1 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>JSON</span>
                    </button>
                  </div>
                </div>

                {/* Revision Module Lists representation */}
                <div className="space-y-6">
                  {studyMaterial.revisionCards.map((rc, idx) => (
                    <div 
                      key={idx}
                      className="rounded-xl border border-stone-200/80 bg-white shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/30 overflow-hidden"
                    >
                      {/* Card topic head */}
                      <div className="flex items-center justify-between bg-stone-50 dark:bg-zinc-900/60 px-5 py-3 border-b border-stone-200/50 dark:border-zinc-800/60">
                        <div className="flex items-center space-x-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-mono text-xs font-extrabold">
                            {idx + 1}
                          </span>
                          <h4 className="font-display font-extrabold text-stone-900 dark:text-zinc-50 text-base">
                            {rc.topic}
                          </h4>
                        </div>

                        <button
                          onClick={() => {
                            const formatted = `${rc.topic}:\n` + rc.points.map(p => `• ${p}`).join("\n");
                            handleCopyToClipboard(formatted, `rev-card-${idx}`);
                          }}
                          className="text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                        >
                          {copiedState[`rev-card-${idx}`] ? (
                            <Check className="h-3.5 w-3.5 text-teal-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Card Content list */}
                      <ul className="p-5 space-y-3">
                        {rc.points.map((point, pIdx) => (
                          <li 
                            key={pIdx}
                            className="flex items-start space-x-3 text-stone-700 dark:text-zinc-300 text-sm leading-relaxed"
                          >
                            <span className="flex h-2 w-2 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

              </div>
            )}

            {/* APPRECIATION FOOTER BOX AFTER THE ENTIRE STUDY CORE IS FORGED */}
            <div className="mt-14 animate-fade-up-delayed">
              <div className="rounded-2xl border border-stone-200/80 bg-teal-600/5 p-8 text-center dark:border-zinc-800/80 dark:bg-teal-500/5 backdrop-blur-sm shadow-sm max-w-lg mx-auto">
                <h4 className="font-display font-bold text-stone-900 dark:text-zinc-50 text-base mb-1.5">
                  ✨ Thank You for Using MindForge AI
                </h4>
                <p className="text-stone-500 dark:text-zinc-400 text-sm leading-relaxed">
                  "Keep learning. Keep growing. Keep forging knowledge."
                </p>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
