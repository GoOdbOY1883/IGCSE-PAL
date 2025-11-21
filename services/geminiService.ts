import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedContent, IgcseSubject, McqQuestion, PastPaperQuestion, SourcedMcqQuestion, TrueFalseQuestion } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// A token is roughly 4 chars. We set a conservative character limit per chunk
// to ensure we don't exceed the model's context window.
const CHAR_LIMIT_PER_CHUNK = 16000;

// Helper to split text into manageable chunks, trying to preserve paragraphs.
export const chunkText = (text: string, limit: number): string[] => {
    if (text.length <= limit) {
        return [text];
    }
    const chunks: string[] = [];
    let currentChunk = "";
    // Split by paragraphs to avoid breaking sentences mid-way
    const paragraphs = text.split('\n\n');

    for (const paragraph of paragraphs) {
        // If adding the next paragraph exceeds the limit, push the current chunk.
        if ((currentChunk.length + paragraph.length + 2) > limit) {
            if (currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
            }
            // If a single paragraph itself is larger than the limit, we have to split it.
            // This is a fallback to prevent infinite loops on massive paragraphs.
            if (paragraph.length > limit) {
                const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
                let subChunk = '';
                for (const sentence of sentences) {
                    if ((subChunk.length + sentence.length) > limit) {
                        chunks.push(subChunk.trim());
                        subChunk = sentence;
                    } else {
                        subChunk += sentence;
                    }
                }
                if (subChunk) chunks.push(subChunk.trim());
                 currentChunk = ''; // Reset current chunk after handling a huge paragraph
            } else {
                 currentChunk = paragraph + '\n\n';
            }
        } else {
            currentChunk += paragraph + '\n\n';
        }
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
};


const generatePrompt = (notes: string, subject: IgcseSubject | null, type: GeneratedContent['type'], isChunk: boolean = false): string => {
  const subjectText = subject ? ` for the IGCSE subject "${subject}"` : '';
  // When processing a chunk, we ask for fewer questions to distribute the generation
  const questionCount = isChunk ? 2 : 5;
  const pastPaperCount = isChunk ? 1 : 3;

  switch (type) {
    case 'brief-summary':
      return `Generate a concise, brief summary of the following notes${subjectText}.\n\nNotes:\n"""\n${notes}\n"""`;
    case 'detailed-summary':
      return `Generate a detailed, comprehensive summary of the following notes${subjectText}.\n\nNotes:\n"""\n${notes}\n"""`;
    case 'mcqs':
      return `Generate ${questionCount} multiple-choice questions with exactly 4 options each based on the following notes${subjectText}. The answer must be one of the options. Notes:\n"""\n${notes}\n"""`;
    case 'true-false':
      return `Generate ${questionCount} true/false questions based on the following notes${subjectText}.\n\nNotes:\n"""\n${notes}\n"""`;
    case 'past-papers':
        return `You are an expert IGCSE tutor. Your task is to generate highly relevant past paper questions based on the provided study notes for the subject "${subject}". Follow this process precisely:

**Step 1: Core Topic Extraction**
First, meticulously analyze the provided notes and identify the core topics, key concepts, and specific details discussed. Do not search for questions yet. This step is about understanding the source material deeply.

**Step 2: Targeted Question Search**
Using the core topics you extracted in Step 1, perform a targeted search for ${pastPaperCount} authentic IGCSE past paper questions. The questions MUST directly relate to the specific content of the notes. Do not select general questions on the same subject; they must be answerable using the information given in the notes.

**Step 3: Difficulty Assessment**
For each question you find, assess its difficulty level and assign one of the following ratings: "Easy", "Medium", or "Hard".

**Step 4: High-Quality Model Answer Creation**
For each question, write a detailed, high-quality model answer. The answer MUST be formatted using specific markdown rules for clarity and structure:
- **Bolding:** Use \`**double asterisks**\` to emphasize all key technical terms, names, dates, and important concepts.
- **Lists:** For step-by-step explanations, sequences, or lists of items, use bullet points (e.g., \`- First point\`, \`- Second point\`).
- **Paragraphs:** Separate distinct ideas into their own paragraphs by using a blank line. Do not write a single block of text.

**Step 5: Final JSON Formatting**
Format your entire output as a single, valid JSON array of objects. Each object in the array must contain three keys:
1.  \`"question"\`: The full text of the past paper question (string).
2.  \`"answer"\`: The detailed model answer, formatted with the markdown rules from Step 4 (string).
3.  \`"difficulty"\`: The assessed difficulty ("Easy", "Medium", or "Hard") (string).

**Important:** Do NOT include any text, explanation, or markdown formatting (like \`\`\`json) outside of the final JSON array. Your entire response must be only the JSON data.

Here are the notes to analyze:
"""
${notes}
"""`;
    default:
      throw new Error('Invalid generation type');
  }
};

const getResponseSchema = (type: GeneratedContent['type']) => {
    switch (type) {
        case 'mcqs':
            return {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        question: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        answer: { type: Type.STRING },
                    },
                    required: ['question', 'options', 'answer'],
                }
            };
        case 'true-false':
            return {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        statement: { type: Type.STRING },
                        answer: { type: Type.BOOLEAN },
                    },
                    required: ['statement', 'answer'],
                }
            };
        default:
            return null;
    }
}

// Internal function for a single API call on a piece of text.
const generateSingle = async (notes: string, subject: IgcseSubject | null, type: GeneratedContent['type'], isChunk: boolean): Promise<GeneratedContent> => {
  const prompt = generatePrompt(notes, subject, type, isChunk);
  const schema = getResponseSchema(type);
  
  let config: any = {};
  
  if (type === 'past-papers') {
    // For past papers, we request JSON but don't provide a rigid schema
    // to allow for markdown in the answer string. We also enable search.
    config = { 
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json" 
    };
  } else if (schema) {
    config = { responseMimeType: "application/json", responseSchema: schema };
  }

  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: config,
    });

    const text = response.text;
    
    if (schema || type === 'past-papers') {
        try {
            // Clean the text to ensure it's valid JSON before parsing
            const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedJson = JSON.parse(cleanedText);
            return { type, content: parsedJson } as GeneratedContent;
        } catch (parseError) {
             console.error("Error parsing Gemini JSON response:", parseError, "Raw text:", text);
             throw new Error("The model returned an invalid format.");
        }
    }

    return { type, content: text } as GeneratedContent;
  } catch(error) {
     console.error("Error in generateSingle call to Gemini:", error);
     throw error;
  }
};


// Main exported function that orchestrates chunking if necessary.
export const generateContentFromGemini = async (notes: string, subject: IgcseSubject | null, type: GeneratedContent['type']): Promise<GeneratedContent> => {
    // If notes are short enough, process them in a single call.
    if (notes.length <= CHAR_LIMIT_PER_CHUNK) {
        return generateSingle(notes, subject, type, false);
    }
    
    console.log(`Notes length (${notes.length}) exceeds limit. Processing in chunks.`);
    const chunks = chunkText(notes, CHAR_LIMIT_PER_CHUNK);
    console.log(`Split notes into ${chunks.length} chunks.`);

    // Strategy 1: For summaries, use a "map-reduce" approach.
    if (type === 'brief-summary' || type === 'detailed-summary') {
        const chunkSummaries = await Promise.all(
            chunks.map(chunk => 
                generateSingle(chunk, subject, 'brief-summary', true)
            )
        );
        const combinedSummaries = chunkSummaries.map(s => s.content).join('\n\n');
        
        // Final reduction step: summarize the combined summaries.
        const finalPrompt = `The following are summaries of different parts of a larger document. Combine them into a single, cohesive ${type === 'brief-summary' ? 'brief' : 'detailed'} summary.\n\nSummaries:\n"""\n${combinedSummaries}\n"""`;

        const response = await ai.models.generateContent({
             model: "gemini-2.5-flash",
             contents: finalPrompt,
        });
        
        return { type, content: response.text };
    }

    // Strategy 2: For quizzes and Q&A, aggregate results from all chunks.
    if (type === 'mcqs' || type === 'true-false' || type === 'past-papers') {
        const allGeneratedContent: any[] = [];
        
        for (const chunk of chunks) {
            try {
                const result = await generateSingle(chunk, subject, type, true);
                if (result.content && Array.isArray(result.content)) {
                    allGeneratedContent.push(...result.content);
                }
            } catch (error) {
                console.warn(`Could not generate content for a chunk, skipping. Error:`, error);
            }
        }
        
        return { type, content: allGeneratedContent };
    }

    throw new Error('Unsupported content type for chunked processing.');
};

export const cleanNotesWithGemini = async (rawNotes: string): Promise<string> => {
    const prompt = `
        You are a text-cleaning assistant. Your task is to process the following study notes and remove all non-essential information.
        Please remove:
        - Page numbers
        - Headers and footers
        - "Learning Outcomes", "Syllabus Aims", or similar sections
        - Tables of contents or indexes
        - Any other administrative or metadata text.
        The output should be ONLY the core educational content, with paragraphs preserved. Do not add any introduction or conclusion of your own.

        Here are the notes:
        """
        ${rawNotes}
        """
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error cleaning notes with Gemini:", error);
        throw new Error("Failed to clean notes.");
    }
};

export const findPastPaperMcqs = async (subject: IgcseSubject, topic: string, count: number, yearRange: number): Promise<GeneratedContent> => {
    const startYear = 2025 - yearRange + 1;
    const endYear = 2025;
    const yearText = yearRange === 1 ? `from the year ${endYear}` : `between the years ${startYear} and ${endYear}`;

    const prompt = `You are an expert IGCSE O-Level examination tutor. Your task is to find authentic past paper Multiple Choice Questions (MCQs) based on a specific subject, topic, and year range. You MUST use your search tool to find these questions from reliable online past paper repositories. Do NOT invent, create, or modify any questions.

**Instructions:**

1.  **Search:** For the IGCSE subject "${subject}" and the topic "${topic}", search for ${count} unique MCQs from official past papers published ${yearText}.
2.  **Extract:** For each question found, you must extract the following information:
    *   The full question text.
    *   Exactly four multiple-choice options.
    *   The correct answer letter or text.
    *   The precise source of the paper (e.g., "June 2022, Paper 1, Variant 2, Question 15").
    *   The full URL of the website where you found the question.
3.  **Format:** Return your findings as a single, valid JSON array of objects. Each object must conform to the specified schema.

**Crucial Constraints:**
*   **Authenticity is Paramount:** Only return questions you have found verbatim from past papers. If you cannot find a real question, do not include a substitute.
*   **No AI Generation:** Do not generate any part of the question, options, or answer. Your role is to find and format existing data.
*   **Complete Data:** Every field (question, options, answer, sourcePaper, sourceUrl) is mandatory for each object.

**Subject:** "${subject}"
**Topic:** "${topic}"
**Number of Questions:** ${count}`;
    
    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING },
                sourcePaper: { type: Type.STRING },
                sourceUrl: { type: Type.STRING }
            },
            required: ['question', 'options', 'answer', 'sourcePaper', 'sourceUrl'],
        }
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{googleSearch: {}}],
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const text = response.text;
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        let parsedJson = JSON.parse(cleanedText) as SourcedMcqQuestion[];

        // Enhance with grounding metadata if available
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks && groundingChunks.length > 0) {
            parsedJson = parsedJson.map((item, index) => {
                // If the model provided a dummy URL, replace it with a more reliable one.
                const source = groundingChunks[index % groundingChunks.length]?.web;
                if (source?.uri && !item.sourceUrl.includes('placeholder.com')) {
                    return { ...item, sourceUrl: source.uri };
                }
                return item;
            });
        }
        
        return { type: 'sourced-mcqs', content: parsedJson };

    } catch (error) {
        console.error("Error finding past paper MCQs with Gemini:", error);
        throw new Error("Failed to find past paper MCQs. The model may have returned an invalid format or an error occurred.");
    }
}

export const parseSmeMcqs = async (rawText: string): Promise<GeneratedContent> => {
    const prompt = `You are a highly accurate text-parsing engine. Your task is to convert a block of text containing multiple-choice questions into a structured JSON format. The text is likely copied from a source like 'Save My Exams'.

**Instructions:**

1.  **Analyze:** Read the entire text block and identify individual multiple-choice questions.
2.  **Extract:** For each question, extract:
    *   \`question\`: The full text of the question itself.
    *   \`options\`: An array of all possible answer options (strings).
    *   \`answer\`: The single correct answer. The correct answer might be indicated by a letter (A, B, C, D) next to the question, an asterisk (*), or a separate answer key section. You must correctly identify it and provide the full text of the correct option.
3.  **Format:** Return the data as a single, valid JSON array of objects.
4.  **Ignore Junk:** Exclude any extraneous text like titles, instructions, "Question 1", "Difficulty: Hard", explanations, or any other text that is not part of the question, options, or the answer key.

**Input Text:**
"""
${rawText}
"""`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: getResponseSchema('mcqs'),
            },
        });

        const text = response.text;
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedJson = JSON.parse(cleanedText);
        return { type: 'mcqs', content: parsedJson };
    } catch (error) {
        console.error("Error parsing MCQs with Gemini:", error);
        throw new Error("Failed to parse MCQs. Please check the format of the pasted text.");
    }
};