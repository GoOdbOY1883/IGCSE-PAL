
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedContent, IgcseSubject, McqQuestion, PastPaperQuestion, SourcedMcqQuestion, TrueFalseQuestion, HurryStudyTopic, TheoryQuestion, TheoryGradingResult, PastPaperGradingResult, Flashcard } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const CHAR_LIMIT_PER_CHUNK = 32000;

const cleanAndParseJson = (text: string | undefined): any => {
    if (!text) {
        throw new Error("The model returned an empty response.");
    }

    try {
        return JSON.parse(text);
    } catch (e) {
        let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const firstSquare = cleaned.indexOf('[');
        const firstCurly = cleaned.indexOf('{');
        
        let startIndex = -1;
        let endIndex = -1;

        if (firstSquare !== -1 && (firstCurly === -1 || firstSquare < firstCurly)) {
            startIndex = firstSquare;
            endIndex = cleaned.lastIndexOf(']');
        } else if (firstCurly !== -1) {
            startIndex = firstCurly;
            endIndex = cleaned.lastIndexOf('}');
        }

        if (startIndex !== -1 && endIndex !== -1) {
            cleaned = cleaned.substring(startIndex, endIndex + 1);
            try {
                return JSON.parse(cleaned);
            } catch (innerError) {
                try {
                     return JSON.parse(cleaned.replace(/,\s*([\]}])/g, '$1'));
                } catch (finalError) {
                    throw new Error("Invalid JSON format found in response.");
                }
            }
        }
        
        throw new Error("The model response did not contain a valid data structure. It might have returned a message instead of data.");
    }
};

export const chunkText = (text: string, limit: number): string[] => {
    if (text.length <= limit) {
        return [text];
    }
    const chunks: string[] = [];
    let currentChunk = "";
    const paragraphs = text.split('\n\n');

    for (const paragraph of paragraphs) {
        if ((currentChunk.length + paragraph.length + 2) > limit) {
            if (currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
            }
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
                 currentChunk = ''; 
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

const generatePrompt = (notes: string, subject: IgcseSubject | null, type: GeneratedContent['type'], isChunk: boolean = false, existingQuestions: string[] = []): string => {
  const subjectText = subject ? ` for the IGCSE subject "${subject}"` : '';
  const isFlashcard = type === 'flashcards';
  const questionCount = isChunk ? (isFlashcard ? 5 : 2) : (isFlashcard ? 15 : 5);
  
  let exclusionText = "";
  if (existingQuestions.length > 0) {
      exclusionText = `\n\n**IMPORTANT EXCLUSION:** Do NOT generate items that are identical or very similar to the following previously generated ones:\n${existingQuestions.slice(-30).map(q => `- ${q}`).join('\n')}\n`;
  }

  switch (type) {
    case 'brief-summary':
      return `Generate a concise, brief summary of the following notes${subjectText}.\n\nNotes:\n"""\n${notes}\n"""`;
    case 'detailed-summary':
      return `Generate a detailed, comprehensive summary of the following notes${subjectText}.\n\nNotes:\n"""\n${notes}\n"""`;
    case 'mcqs':
      return `Generate ${questionCount} multiple-choice questions with exactly 4 options each based on the following notes${subjectText}. The answer must be one of the options.${exclusionText} Notes:\n"""\n${notes}\n"""`;
    case 'true-false':
      return `Generate ${questionCount} true/false questions based on the following notes${subjectText}.${exclusionText}\n\nNotes:\n"""\n${notes}\n"""`;
    case 'flashcards':
      return `Identify ${questionCount} key terms, concepts, or definitions from the following notes${subjectText}. Return a JSON array of objects with "term" and "definition" properties.${exclusionText}\n\nNotes:\n"""\n${notes}\n"""`;
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
        case 'flashcards':
            return {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        term: { type: Type.STRING },
                        definition: { type: Type.STRING },
                    },
                    required: ['term', 'definition'],
                }
            };
        default:
            return null;
    }
}

const generateSingle = async (notes: string, subject: IgcseSubject | null, type: GeneratedContent['type'], isChunk: boolean, existingQuestions: string[] = []): Promise<GeneratedContent> => {
  const prompt = generatePrompt(notes, subject, type, isChunk, existingQuestions);
  const schema = getResponseSchema(type);
  
  let config: any = {};
  if (schema) {
    config = { responseMimeType: "application/json", responseSchema: schema };
  }

  const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: config,
  });

  const text = response.text;
  if (!text) throw new Error("Model returned an empty response.");

  if (schema) {
    const parsedJson = cleanAndParseJson(text);
    return { type, content: parsedJson } as GeneratedContent;
  }

  return { type, content: text } as GeneratedContent;
};

const generatePastPapersFromNotes = async (notes: string, subject: IgcseSubject | null): Promise<GeneratedContent> => {
    const extractionPrompt = `Analyze the following study notes. Identify the main Topic/Chapter name.
    Subject provided: ${subject || "Not specified"}
    Return a JSON object with: { "subject": "...", "topic": "...", "searchQuery": "..." }`;

    let searchContext = { subject: subject || '', topic: '', searchQuery: '' };
    try {
        const extractionResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: extractionPrompt,
            config: { responseMimeType: "application/json" }
        });
        searchContext = cleanAndParseJson(extractionResponse.text);
    } catch (e) {
        searchContext.searchQuery = `${subject || 'IGCSE'} questions based on notes`;
    }

    const prompt = `You are an expert IGCSE tutor. Find 4-5 authentic IGCSE past paper questions for topic "${searchContext.topic}".
    
    Instructions:
    - Use Google Search.
    - If direct search snippets are sparse, use your internal knowledge of official past papers to provide authentic questions verbatim.
    - **NEVER** return an apology.
    - **ALWAYS** return a JSON array of questions.
    
    Output Format: JSON array inside a code block.
    Schema: [{ "question": "...", "answer": "...", "difficulty": "...", "sourceUrl": "...", "imageUrl": "..." }]`;

    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
    });
    
    const text = response.text;
    const parsedJson = cleanAndParseJson(text) as PastPaperQuestion[];
    return { type: 'past-papers', content: parsedJson };
}

export const generateContentFromGemini = async (notes: string, subject: IgcseSubject | null, type: GeneratedContent['type'], existingQuestions: string[] = []): Promise<GeneratedContent> => {
    if (type === 'past-papers') {
        return generatePastPapersFromNotes(notes, subject);
    }

    if (notes.length <= CHAR_LIMIT_PER_CHUNK) {
        return generateSingle(notes, subject, type, false, existingQuestions);
    }
    
    const chunks = chunkText(notes, CHAR_LIMIT_PER_CHUNK);
    if (type === 'brief-summary' || type === 'detailed-summary') {
        const chunkSummaries = await Promise.all(
            chunks.map(chunk => generateSingle(chunk, subject, 'brief-summary', true))
        );
        const combinedSummaries = chunkSummaries.map(s => s.content).join('\n\n');
        const finalPrompt = `Combine these summaries into a single cohesive ${type === 'brief-summary' ? 'brief' : 'detailed'} summary:\n\n${combinedSummaries}`;
        const response = await ai.models.generateContent({
             model: "gemini-3-flash-preview",
             contents: finalPrompt,
        });
        if (!response.text) throw new Error("Empty response from model during summary merge.");
        return { type, content: response.text };
    }

    if (type === 'mcqs' || type === 'true-false' || type === 'flashcards') {
        const allGeneratedContent: any[] = [];
        for (const chunk of chunks) {
            try {
                const result = await generateSingle(chunk, subject, type, true, existingQuestions);
                if (result.content && Array.isArray(result.content)) {
                    allGeneratedContent.push(...result.content);
                }
            } catch (error) {
                console.warn(`Could not generate content for a chunk.`, error);
            }
        }
        return { type, content: allGeneratedContent };
    }

    throw new Error('Unsupported content type for chunked processing.');
};

export const cleanNotesWithGemini = async (rawNotes: string): Promise<string> => {
    const prompt = `Remove all non-essential information (page numbers, headers, syllabus outcomes) from these notes. Return ONLY core educational content.\n\nNotes:\n"""\n${rawNotes}\n"""`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
    });
    const text = response.text;
    if (!text) throw new Error("Model returned an empty response during cleaning.");
    return text.trim();
};

export const findPastPaperMcqs = async (subject: IgcseSubject, topic: string, count: number, yearRange: number): Promise<GeneratedContent> => {
    const startYear = 2025 - yearRange + 1;
    const yearText = yearRange === 1 ? `from 2025` : `between ${startYear} and 2025`;

    const prompt = `Find ${count} authentic IGCSE MCQs for "${subject}" topic "${topic}" published ${yearText}.
    
    Constraints:
    - Verbatim from past papers.
    - **NEVER** return an apology text like "I cannot find...". 
    - If search results are limited, use your training data on authentic papers.
    - Return a JSON array inside a code block.
    
    Schema: [{ "question": "...", "options": ["..."], "answer": "...", "sourcePaper": "...", "sourceUrl": "..." }]`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { tools: [{googleSearch: {}}] },
    });

    const parsedJson = cleanAndParseJson(response.text) as SourcedMcqQuestion[];
    return { type: 'sourced-mcqs', content: parsedJson };
}

export const generateTopicMcqs = async (subject: IgcseSubject, topic: string, count: number): Promise<GeneratedContent> => {
    const prompt = `Convert the theory of topic "${topic}" into ${count} high-quality IGCSE style MCQs. Return a JSON array.`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: getResponseSchema('mcqs'),
        }
    });
    const parsed = cleanAndParseJson(response.text);
    return { type: 'mcqs', content: parsed };
}

export const findSpecificPastPaperQuestions = async (subject: IgcseSubject, topic: string, criteria: string, count: number, yearRange: number): Promise<GeneratedContent> => {
    const startYear = 2025 - yearRange + 1;
    const yearText = yearRange === 1 ? `from 2025` : `from ${startYear} to 2025`;

    const prompt = `Find ${count} authentic IGCSE questions for "${subject}" topic "${topic}" matching: "${criteria}". Years: ${yearText}.
    
    Instructions:
    - Use Google Search.
    - If direct search fails, provide authentic questions from your memory of past papers.
    - **NEVER** return an apology. 
    - **ALWAYS** return a JSON array.
    
    Schema: [{ "question": "...", "answer": "...", "difficulty": "...", "sourceUrl": "...", "imageUrl": "..." }]`;

    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
    });
    
    const parsedJson = cleanAndParseJson(response.text) as PastPaperQuestion[];
    return { type: 'past-papers', content: parsedJson };
}

export const gradePastPaperAnswer = async (question: string, modelAnswer: string, studentAnswer: string): Promise<PastPaperGradingResult> => {
    const prompt = `Grade this IGCSE answer.\nQuestion: "${question}"\nMark Scheme: "${modelAnswer}"\nStudent: "${studentAnswer}"\n\nReturn JSON: { "score": number, "maxScore": number, "feedback": "string" }`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return cleanAndParseJson(response.text);
}

export const parseSmeMcqs = async (rawText: string): Promise<GeneratedContent> => {
    const prompt = `Extract or generate MCQs from this text. Return JSON array. [{ "question": "...", "options": ["..."], "answer": "..." }]\n\nText:\n${rawText}`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: getResponseSchema('mcqs'),
        },
    });
    const parsedJson = cleanAndParseJson(response.text);
    return { type: 'mcqs', content: parsedJson };
};

export const generateMoreSmeMcqs = async (rawText: string, existingQuestions: string[]): Promise<GeneratedContent> => {
    const existingQuestionsText = existingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');
    const prompt = `Generate 5-10 *new* MCQs from the text, excluding these: ${existingQuestionsText}\n\nText:\n${rawText}`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: getResponseSchema('mcqs'),
        },
    });
    const parsedJson = cleanAndParseJson(response.text);
    return { type: 'mcqs', content: parsedJson };
};

export const editImageWithGemini = async (base64Image: string, mimeType: string, prompt: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
            parts: [
                { inlineData: { data: base64Image, mimeType: mimeType } },
                { text: prompt }
            ]
        }
    });
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
        for (const part of parts) {
            if (part.inlineData) return part.inlineData.data;
        }
    }
    throw new Error("No image generated by the model.");
}

export const extractTopicsFromNotes = async (notes: string): Promise<HurryStudyTopic[]> => {
    const prompt = `Identify up to 6 distinct topics from these notes. Return JSON array [{ "id": "...", "name": "..." }].\n\nNotes:\n${notes.slice(0, 80000)}`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return cleanAndParseJson(response.text);
}

export const explainTopicSimple = async (notes: string, topicName: string): Promise<string> => {
    const prompt = `Explain topic "${topicName}" simply based on these notes. Use bolding for terms and blockquotes for takeaways.\n\nNotes:\n${notes.slice(0, 100000)}`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
    });
    const text = response.text;
    if (!text) throw new Error("Empty response from explanation model.");
    return text;
}

export const generateTheoryQuestions = async (notes: string, topicName: string): Promise<{easy: TheoryQuestion[], hard: TheoryQuestion[]}> => {
    const prompt = `Generate 5 easy and 5 hard IGCSE theory questions for topic "${topicName}" from these notes. Return JSON object.`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    const parsed = cleanAndParseJson(response.text);
    const easy = (parsed.easy || []).map((q: any, i: number) => ({ id: i, question: q.question, type: 'easy' }));
    const hard = (parsed.hard || []).map((q: any, i: number) => ({ id: i + 5, question: q.question, type: 'hard' }));
    return { easy, hard };
}

export const gradeTheoryQuestions = async (notes: string, topicName: string, questions: TheoryQuestion[], answers: {[key: number]: string}): Promise<TheoryGradingResult> => {
    const qaPairs = questions.map(q => `Q (${q.type}): ${q.question}\nAns: ${answers[q.id] || "None"}`).join('\n\n');
    const prompt = `Grade these IGCSE theory answers. Return JSON.\n\nPairs:\n${qaPairs}\n\nNotes:\n${notes.slice(0, 100000)}`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    const parsed = cleanAndParseJson(response.text);
    if (parsed.feedbacks && parsed.feedbacks.length === questions.length) {
        parsed.feedbacks.forEach((f: any, i: number) => { f.questionId = questions[i].id; });
    }
    return parsed;
}

export const generateDrillQuestions = async (notes: string, topicName: string, previousQuestions?: { tf: string[], mcq: string[] }): Promise<{tf: TrueFalseQuestion[], mcq: McqQuestion[]}> => {
    const prompt = `Generate 10 T/F and 10 MCQs for topic "${topicName}". Return JSON.`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return cleanAndParseJson(response.text);
}
