/**
 * Utility for parsing TXT, DOCX, and PDF study materials in the frontend.
 * Loads lightweight libraries from robust raw CDNs dynamically to keep production bundles light and prevent bundler workers collision.
 */

const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
};

export async function parseTxtFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error("Error reading text file."));
    };
    reader.readAsText(file);
  });
}

export async function parseDocxFile(file: File): Promise<string> {
  try {
    // Dynamic load mammoth
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js");
    const mammoth = (window as any).mammoth;
    if (!mammoth) {
      throw new Error("Mammoth parser is not loaded. Please try again.");
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const arrayBuffer = reader.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          resolve(result.value || "");
        } catch (err) {
          reject(new Error("Error extracting MS Word document: " + (err as Error).message));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read Word document."));
      reader.readAsArrayBuffer(file);
    });
  } catch (error: any) {
    throw new Error("Word file parser error: " + error.message);
  }
}

export async function parsePdfFile(file: File): Promise<string> {
  try {
    // Dynamic load pdf.js
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    const pdfjsLib = (window as any)["pdfjs-dist/build/pdf"];
    if (!pdfjsLib) {
      throw new Error("PDF parser is not loaded. Please try again.");
    }
    // Set worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const arrayBuffer = reader.result as ArrayBuffer;
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          let extractedText = "";

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(" ");
            extractedText += pageText + "\n";
          }

          resolve(extractedText.trim() || "");
        } catch (err) {
          reject(new Error("Error extracting PDF pages: " + (err as Error).message));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read PDF file."));
      reader.readAsArrayBuffer(file);
    });
  } catch (error: any) {
    throw new Error("PDF parser error: " + error.message);
  }
}

export async function extractTextFromFile(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  
  if (extension === "txt") {
    return await parseTxtFile(file);
  } else if (extension === "docx") {
    return await parseDocxFile(file);
  } else if (extension === "pdf") {
    return await parsePdfFile(file);
  } else {
    throw new Error(`Unsupported file type: .${extension}. Only PDF, DOCX, and TXT are supported.`);
  }
}
