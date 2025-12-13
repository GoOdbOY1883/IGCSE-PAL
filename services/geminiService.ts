
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedContent, IgcseSubject, McqQuestion, PastPaperQuestion, SourcedMcqQuestion, TrueFalseQuestion, HurryStudyTopic, TheoryQuestion, TheoryGradingResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// A token is roughly 4 chars. Gemini 2.5 Flash has a huge context window.
// We set a larger limit to keep context together where possible.
const CHAR_LIMIT_PER_CHUNK = 32000;

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
    // Note: past-papers type is now handled by a specialized function, but we keep this as fallback
    case 'past-papers':
        return `Generate relevant past paper style questions based on these notes.`;
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
  
  if (schema) {
    config = { responseMimeType: "application/json", responseSchema: schema };
  }

  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: config,
    });

    const text = response.text;
    
    if (schema) {
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

// Specialized function to handle Past Paper generation by first identifying the topic then searching
const generatePastPapersFromNotes = async (notes: string, subject: IgcseSubject | null): Promise<GeneratedContent> => {
    console.log("Generating past papers via Topic Extraction + Search strategy");

    // Step 1: Extract Topic
    // We look at the first ~15k chars to identify the topic.
    // We use responseMimeType: 'application/json' here because NO TOOLS are used.
    const extractionPrompt = `Analyze the following study notes. Identify the specific IGCSE Subject (if not provided) and the main Topic/Chapter name.
    Subject provided: ${subject || "Not specified"}
    
    Return a JSON object with:
    - subject: string
    - topic: string
    - searchQuery: A specific search phrase to find IGCSE past paper questions for this topic (e.g. "IGCSE Physics Thermal Properties past paper questions worksheet pdf")
    
    Notes Preview:
    """
    ${notes.slice(0, 15000)}
    """`;

    let searchContext = { subject: subject || '', topic: '', searchQuery: '' };

    try {
        const extractionResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: extractionPrompt,
            config: { responseMimeType: "application/json" }
        });
        searchContext = JSON.parse(extractionResponse.text);
    } catch (e) {
        console.warn("Topic extraction failed, falling back to generic search.", e);
        searchContext.searchQuery = `${subject || 'IGCSE'} questions based on notes`;
    }

    console.log("Extracted context:", searchContext);

    // Step 2: Search and Generate Questions
    // IMPORTANT: We use googleSearch tool, so we CANNOT use responseMimeType: 'application/json'.
    // We ask for JSON in the prompt text instead.
    const prompt = `You are an expert IGCSE tutor.
    Task: Find 4-5 authentic, high-quality IGCSE past paper questions (can be Theory or multiple choice) that test the topic "${searchContext.topic}".
    
    Use the Google Search tool to find real questions from past papers.
    Search Query: "${searchContext.searchQuery}"
    
    For each question found:
    1.  **Question**: The exact text of the question.
    2.  **Answer**: A detailed model answer (use bolding for key terms).
    3.  **Difficulty**: Easy, Medium, or Hard.
    
    Output Format: Return a SINGLE JSON array of objects inside a markdown code block (e.g., \`\`\`json ... \`\`\`).
    Schema: [{ "question": "...", "answer": "...", "difficulty": "..." }]`;

    try {
            const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                // Do NOT set responseMimeType here.
            }
        });
        
        const text = response.text;
        // Parse JSON manually from the text response
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedJson = JSON.parse(cleanedText);
        return { type: 'past-papers', content: parsedJson };

    } catch (error) {
        console.error("Error generating past papers:", error);
        throw new Error("Failed to find relevant past paper questions. Please try again.");
    }
}


// Main exported function that orchestrates chunking if necessary.
export const generateContentFromGemini = async (notes: string, subject: IgcseSubject | null, type: GeneratedContent['type']): Promise<GeneratedContent> => {
    // Strategy for Past Papers: "Read Notes -> Identify Topic -> Search Questions"
    if (type === 'past-papers') {
        return generatePastPapersFromNotes(notes, subject);
    }

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

    // Strategy 2: For quizzes, aggregate results from all chunks.
    if (type === 'mcqs' || type === 'true-false') {
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

    // IMPORTANT: We use googleSearch tool, so we CANNOT use responseMimeType: 'application/json'.
    const prompt = `You are an expert IGCSE O-Level examination tutor. Your task is to find authentic past paper Multiple Choice Questions (MCQs) based on a specific subject, topic, and year range. You MUST use your search tool to find these questions from reliable online past paper repositories. Do NOT invent, create, or modify any questions.

**Instructions:**

1.  **Search:** For the IGCSE subject "${subject}" and the topic "${topic}", search for ${count} unique MCQs from official past papers published ${yearText}.
2.  **Extract:** For each question found, you must extract the following information:
    *   The full question text.
    *   Exactly four multiple-choice options.
    *   The correct answer letter or text.
    *   The precise source of the paper (e.g., "June 2022, Paper 1, Variant 2, Question 15").
    *   The full URL of the website where you found the question.
3.  **Format:** Return your findings as a single, valid JSON array of objects inside a markdown code block (e.g., \`\`\`json ... \`\`\`).

**Crucial Constraints:**
*   **Authenticity is Paramount:** Only return questions you have found verbatim from past papers. If you cannot find a real question, do not include a substitute.
*   **No AI Generation:** Do not generate any part of the question, options, or answer. Your role is to find and format existing data.
*   **Complete Data:** Every field (question, options, answer, sourcePaper, sourceUrl) is mandatory for each object.

**Subject:** "${subject}"
**Topic:** "${topic}"
**Number of Questions:** ${count}`;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{googleSearch: {}}],
                // No responseMimeType or responseSchema here to avoid tool conflict
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
    // UPDATED PROMPT: Handles both existing MCQs and raw notes by generating questions if needed.
    const prompt = `You are an intelligent educational AI assistant. Your task is to output a structured Multiple Choice Quiz (MCQ) from the provided input text.

    **Analysis Strategy:**
    
    1.  **Check for Existing Questions:** Does the text contain pre-written multiple-choice questions (e.g., from a past paper PDF)?
        *   **If YES:** Extract the questions and options. 
        *   **CRITICAL:** If the answer key is missing, YOU MUST SOLVE THE QUESTION yourself and provide the correct answer. Do not skip questions because the answer is missing.
    
    2.  **Check for Study Notes:** If the text does NOT contain clearly formatted questions (e.g., it is just study notes, summaries, or paragraphs of text):
        *   **If YES:** GENERATE new high-quality multiple-choice questions based on the content of the notes.
        *   Create between 5 to 15 questions depending on the length of the text.

    **Output Format:**
    Return a single JSON array of objects.
    Each object must have:
    - \`question\`: The question text.
    - \`options\`: An array of exactly 4 strings.
    - \`answer\`: The correct option string (must be one of the options).

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
        throw new Error("Failed to parse MCQs. The input format might be unclear, or the content was not suitable for a quiz.");
    }
};

export const generateMoreSmeMcqs = async (rawText: string, existingQuestions: string[]): Promise<GeneratedContent> => {
    // Truncate existing questions list to avoid hitting prompt limits if it gets huge, though Gemini context is large.
    // We just take the question text.
    const existingQuestionsText = existingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');
    
    const prompt = `You are an intelligent educational AI assistant. 
    Task: Generate 5-10 *new* Multiple Choice Questions (MCQ) from the provided input text.
    
    **Constraint:** 
    The following questions have ALREADY been generated. **Do not** repeat them.
    Focus on topics, details, concepts, or sections of the text that have **not** yet been tested.
    If the text is fully covered, create questions that test understanding from a different angle or deeper inference.
    
    **Existing Questions (to avoid):**
    """
    ${existingQuestionsText}
    """
    
    **Input Text:**
    """
    ${rawText}
    """
    
    **Output Format:**
    Return a single JSON array of objects with the standard schema:
    - \`question\`: string
    - \`options\`: string[] (4 options)
    - \`answer\`: string (must be one of the options)
    `;

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
        console.error("Error generating more MCQs:", error);
        throw new Error("Failed to generate additional MCQs.");
    }
};

// --- Hurry Study Services ---

export const extractTopicsFromNotes = async (notes: string): Promise<HurryStudyTopic[]> => {
    const prompt = `Analyze the provided study notes. Identify the distinct main topics or sections (e.g., "Cotton Industries", "Nuclear Physics", "The Prophet's Life"). 
    Limit to 6 distinct topics.
    Return a JSON array of objects with "id" (random string) and "name" (topic name).
    
    Notes:
    """
    ${notes.slice(0, 25000)}
    """`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            name: { type: Type.STRING }
                        },
                        required: ['id', 'name']
                    }
                }
            }
        });
        const parsed = JSON.parse(response.text);
        return parsed;
    } catch (e) {
        console.error("Error extracting topics", e);
        return [{ id: '1', name: 'General Content' }];
    }
}

export const explainTopicSimple = async (notes: string, topicName: string): Promise<string> => {
    const prompt = `Based strictly on the provided notes, explain the topic "${topicName}" in a simple, easy-to-grasp manner for a student.
    
    **Format Instructions:**
    - Use "## " for main sections (e.g., Introduction, Key Processes, Significance).
    - Use "### " for sub-sections.
    - Use bullet points "- " for lists.
    - **CRITICAL:** Use "**bold**" for ALL key terms, definitions, and important dates.
    - Use "> " (blockquotes) for "Key Takeaways" or "Important Rules/Formulas" to highlight them.
    - Make the content visually structured, spaced out, and easy to scan.
    
    Notes:
    """
    ${notes.slice(0, 30000)}
    """`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
    });
    return response.text;
}

export const generateTheoryQuestions = async (notes: string, topicName: string): Promise<{easy: TheoryQuestion[], hard: TheoryQuestion[]}> => {
    const prompt = `You are an examiner creating a test based ONLY on the provided study notes for the topic "${topicName}".
    
    Task:
    1. Generate 5 "Easy" questions (answerable in 2-3 lines).
    2. Generate 5 "Hard" questions (answerable in 3-6 lines).
    
    CRITICAL INSTRUCTIONS:
    - **Strict Grounding:** You must ONLY ask questions where the answer is explicitly found in the "Notes" section below.
    - **No Outside Knowledge:** Do not ask about facts, dates, or concepts not present in the text, even if they are relevant to the topic in real life.
    - **Verification:** Before outputting a question, verify that the answer exists in the provided text.
    
    Return a JSON object: { "easy": [{ "question": "..." }], "hard": [{ "question": "..." }] }
    
    Notes:
    """
    ${notes.slice(0, 30000)}
    """`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json"
        }
    });
    
    const parsed = JSON.parse(response.text);
    const easy = parsed.easy.map((q: any, i: number) => ({ id: i, question: q.question, type: 'easy' }));
    const hard = parsed.hard.map((q: any, i: number) => ({ id: i + 5, question: q.question, type: 'hard' }));
    
    return { easy, hard };
}

export const gradeTheoryQuestions = async (notes: string, topicName: string, questions: TheoryQuestion[], answers: {[key: number]: string}): Promise<TheoryGradingResult> => {
    const qaPairs = questions.map(q => `Question (${q.type}): ${q.question}\nStudent Answer: ${answers[q.id] || "No answer provided."}`).join('\n\n');

    const prompt = `You are a Cambridge O Level examiner. Grade the following student answers based on the provided notes for topic "${topicName}".
    
    For each question:
    1. Score it (Easy questions out of 3, Hard questions out of 6).
    2. Provide constructive feedback and the correct model answer.
    
    Also provide general advice on how to improve.
    
    Return JSON:
    {
        "feedbacks": [
            { "questionId": number, "score": number, "maxScore": number, "feedback": "...", "modelAnswer": "..." }
        ],
        "generalAdvice": "...",
        "totalScore": number,
        "maxTotalScore": number
    }
    
    Q&A Pairs:
    ${qaPairs}
    
    Context Notes:
    """
    ${notes.slice(0, 20000)}
    """`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json"
        }
    });

    // Remap question IDs if the model hallucinates them, assuming sequential order
    const parsed = JSON.parse(response.text);
    if (parsed.feedbacks && parsed.feedbacks.length === questions.length) {
        parsed.feedbacks.forEach((f: any, i: number) => {
            f.questionId = questions[i].id;
        });
    }
    
    return parsed;
}

export const generateDrillQuestions = async (notes: string, topicName: string): Promise<{tf: TrueFalseQuestion[], mcq: McqQuestion[]}> => {
    const prompt = `Generate drill questions for topic "${topicName}" based STRICTLY on the notes.
    1. 10 True/False questions.
    2. 10 Multiple Choice Questions (4 options).
    
    CRITICAL: 
    - All questions must be answerable purely from the provided notes.
    - Do not use outside knowledge.
    
    Return JSON:
    {
        "tf": [{ "statement": "...", "answer": boolean }],
        "mcq": [{ "question": "...", "options": ["..."], "answer": "..." }]
    }
    
    Notes:
    """
    ${notes.slice(0, 30000)}
    """`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json"
        }
    });
    
    return JSON.parse(response.text);
}
