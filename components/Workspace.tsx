// FIX: Implement the Workspace component. This file was previously empty, causing module resolution errors in App.tsx and "Cannot find name" errors.
import React, { useState, useCallback } from 'react';
import { IgcseSubject, GeneratedContent, PastPaperQuestion, IgcseSubjectKey } from '../types';
import { SUBJECT_TOPICS } from '../subjectData';
import NoteInput from './NoteInput';
import ResultsDisplay from './ResultsDisplay';
import { generateContentFromGemini, cleanNotesWithGemini, chunkText, findPastPaperMcqs, parseSmeMcqs } from '../services/geminiService';
import { LoadingSpinner, ArrowLeftIcon } from './icons';

declare var pdfjsLib: any;

interface WorkspaceProps {
  subject: IgcseSubject | null;
  notes: string;
  setNotes: React.Dispatch<React.SetStateAction<string>>;
  generatedContent: GeneratedContent[];
  setGeneratedContent: React.Dispatch<React.SetStateAction<GeneratedContent[]>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  onBack: () => void;
  // State lifted to App.tsx for persistence
  notesCleaned: boolean;
  setNotesCleaned: React.Dispatch<React.SetStateAction<boolean>>;
  noteParts: string[];
  setNoteParts: React.Dispatch<React.SetStateAction<string[]>>;
  currentPartIndex: number;
  setCurrentPartIndex: React.Dispatch<React.SetStateAction<number>>;
  // Callback to save past papers
  onSavePastPapers?: (subject: IgcseSubject, questions: PastPaperQuestion[]) => void;
}

type WorkspaceView = 'notes' | 'pastPapers' | 'smeParser';

const Workspace: React.FC<WorkspaceProps> = ({
  subject,
  notes,
  setNotes,
  generatedContent,
  setGeneratedContent,
  isLoading,
  setIsLoading,
  onBack,
  notesCleaned,
  setNotesCleaned,
  noteParts,
  setNoteParts,
  currentPartIndex,
  setCurrentPartIndex,
  onSavePastPapers
}) => {
  const [view, setView] = useState<WorkspaceView>('notes');
  const [isCleaning, setIsCleaning] = useState(false);
  
  // State for Past Paper MCQ finder
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedSubtopic, setSelectedSubtopic] = useState('');
  const [mcqCount, setMcqCount] = useState(5);
  const [yearRange, setYearRange] = useState(2); // Default to last 2 years (2025-2024)

  const [smeText, setSmeText] = useState('');
  const [isSmeDragging, setIsSmeDragging] = useState(false);


  // Character limit for splitting notes into user-facing parts
  const USER_CHUNK_LIMIT = 30000;

  const handleCleanNotes = async () => {
    if (!notes.trim() || isCleaning) return;

    setIsCleaning(true);
    try {
      const cleanedNotes = await cleanNotesWithGemini(notes);
      
      if (cleanedNotes.length > USER_CHUNK_LIMIT) {
        const chunks = chunkText(cleanedNotes, USER_CHUNK_LIMIT);
        setNoteParts(chunks);
        setCurrentPartIndex(0);
        setNotes(chunks[0]); // Update main notes to the first part
      } else {
        setNotes(cleanedNotes);
        setNoteParts([]); // Clear parts if not needed
      }
      setNotesCleaned(true);
      setGeneratedContent([]); // Clear previous results
    } catch (error) {
      console.error("Failed to clean notes:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setGeneratedContent([{type: 'brief-summary', content: `Error: Could not clean your notes.\n${errorMessage}`}]);
    } finally {
      setIsCleaning(false);
    }
  };
  
  const handleNextPart = () => {
    const nextIndex = currentPartIndex + 1;
    if (nextIndex < noteParts.length) {
        setCurrentPartIndex(nextIndex);
        setNotes(noteParts[nextIndex]);
        setGeneratedContent([]); // Clear results for the new part
    }
  };

  const handleGenerate = async (type: GeneratedContent['type']) => {
    if (!notes.trim() || isLoading) return;
    setIsLoading(true);
    setGeneratedContent([]);
    try {
      const result = await generateContentFromGemini(notes, subject, type);
      setGeneratedContent(prev => [result, ...prev]);
      if (subject && onSavePastPapers && result.type === 'past-papers' && Array.isArray(result.content) && result.content.length > 0) {
        onSavePastPapers(subject, result.content as PastPaperQuestion[]);
      }
    } catch (error) {
      console.error("Failed to generate content:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setGeneratedContent(prev => [{type: 'brief-summary', content: `Error: Could not generate content.\n${errorMessage}`}, ...prev]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFindMcqs = async () => {
    if (!subject || !selectedChapter || !selectedSubtopic || isLoading) return;
    setIsLoading(true);
    setGeneratedContent([]);
    try {
        const fullTopic = `${selectedChapter} - ${selectedSubtopic}`;
        const result = await findPastPaperMcqs(subject, fullTopic, mcqCount, yearRange);
        setGeneratedContent([result]);
    } catch (error) {
        console.error("Failed to find MCQs:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        setGeneratedContent([{type: 'brief-summary', content: `Error: Could not find MCQs.\n${errorMessage}`}]);
    } finally {
        setIsLoading(false);
    }
  };

  const handleParseSme = async () => {
    if (!smeText.trim() || isLoading) return;
    setIsLoading(true);
    setGeneratedContent([]);
    try {
        const result = await parseSmeMcqs(smeText);
        setGeneratedContent([result]);
    } catch (error) {
        console.error("Failed to parse MCQs:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        setGeneratedContent([{type: 'brief-summary', content: `Error: Could not parse MCQs.\n${errorMessage}`}]);
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleSmeFile = async (file: File) => {
    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const typedArray = new Uint8Array(e.target!.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        let textContent = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const text = await page.getTextContent();
          textContent += text.items.map(s => (s as any).str).join(' ') + '\n';
        }
        setSmeText(prev => `${prev}\n\n--- Appended from ${file.name} ---\n${textContent}`);
      };
      reader.readAsArrayBuffer(file);
    } else { // txt files
      const text = await file.text();
      setSmeText(prev => `${prev}\n\n--- Appended from ${file.name} ---\n${text}`);
    }
  };

  const handleSmeFiles = (files: FileList | null) => {
    if (files) {
      Array.from(files).forEach(handleSmeFile);
    }
  };
  
  const onSmeDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsSmeDragging(true);
  }, []);

  const onSmeDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsSmeDragging(false);
  }, []);

  const onSmeDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsSmeDragging(false);
    handleSmeFiles(e.dataTransfer.files);
  }, []);


  const igcseTools = [
    { label: 'Brief Summary', type: 'brief-summary' as const },
    { label: 'Detailed Summary', type: 'detailed-summary' as const },
    { label: 'MCQs', type: 'mcqs' as const },
    { label: 'True/False', type: 'true-false' as const },
    { label: 'Past Papers Q&A', type: 'past-papers' as const },
  ];
  
  const generalTools = [
      { label: 'Brief Summary', type: 'brief-summary' as const },
      { label: 'Detailed Summary', type: 'detailed-summary' as const },
      { label: 'MCQs', type: 'mcqs' as const },
      { label: 'True/False', type: 'true-false' as const },
  ];
  
  const tools = subject ? igcseTools : generalTools;

  // --- Derived state for MCQ topic selection ---
  const availableChapters = (subject && SUBJECT_TOPICS[Object.keys(SUBJECT_TOPICS).find(k => SUBJECT_TOPICS[k as IgcseSubjectKey] && k.includes(subject.split(' ')[0].toLowerCase())) as IgcseSubjectKey]) || [];
  const availableSubtopics = availableChapters.find(c => c.name === selectedChapter)?.subtopics || [];

  const handleChapterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedChapter(e.target.value);
    setSelectedSubtopic(''); // Reset subtopic when chapter changes
  };

  const renderLeftPanel = () => {
    switch(view) {
        case 'pastPapers':
            return (
                <div className="flex flex-col gap-4">
                    <h2 className="text-xl font-semibold mb-2">Practice Past Paper MCQs</h2>
                    
                    <div>
                        <label htmlFor="chapter" className="block text-sm font-medium text-gray-700">Chapter</label>
                        <select
                            id="chapter"
                            value={selectedChapter}
                            onChange={handleChapterChange}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        >
                            <option value="" disabled>Select a chapter</option>
                            {availableChapters.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="subtopic" className="block text-sm font-medium text-gray-700">Subtopic</label>
                        <select
                            id="subtopic"
                            value={selectedSubtopic}
                            onChange={(e) => setSelectedSubtopic(e.target.value)}
                            disabled={!selectedChapter}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md disabled:bg-gray-50"
                        >
                            <option value="" disabled>Select a subtopic</option>
                            {availableSubtopics.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="q_count" className="block text-sm font-medium text-gray-700">Number of Questions</label>
                            <input 
                                type="number" 
                                id="q_count"
                                value={mcqCount}
                                min="1"
                                max="10"
                                onChange={(e) => setMcqCount(parseInt(e.target.value, 10))}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>
                        <div>
                           <label htmlFor="year_range" className="block text-sm font-medium text-gray-700">Year Range</label>
                           <select 
                                id="year_range"
                                value={yearRange}
                                onChange={(e) => setYearRange(parseInt(e.target.value, 10))}
                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                           >
                                <option value={1}>Last year (2025)</option>
                                <option value={2}>Last 2 years (2024-25)</option>
                                <option value={3}>Last 3 years (2023-25)</option>
                                <option value={5}>Last 5 years (2021-25)</option>
                                <option value={8}>Last 8 years (2018-25)</option>
                           </select>
                        </div>
                    </div>

                    <button onClick={handleFindMcqs} disabled={isLoading || !selectedChapter || !selectedSubtopic} className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all">
                        {isLoading ? <><LoadingSpinner /><span className="ml-2">Finding...</span></> : 'Find MCQs'}
                    </button>
                    <p className="text-sm text-gray-500 mt-2">Find real O-Level past paper MCQs for a specific topic without uploading notes.</p>
                </div>
            );
        case 'smeParser':
            return (
                <div className="flex flex-col gap-4">
                    <h2 className="text-xl font-semibold mb-2">Parse 'Save My Exams' MCQs</h2>
                    <textarea
                        value={smeText}
                        onChange={(e) => setSmeText(e.target.value)}
                        placeholder="Paste MCQs copied from a website like Save My Exams here, or upload a file below..."
                        className="w-full h-48 p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                     <div 
                        onDragOver={onSmeDragOver}
                        onDragLeave={onSmeDragLeave}
                        onDrop={onSmeDrop}
                        className={`relative p-6 border-2 border-dashed rounded-lg text-center transition-colors ${isSmeDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}
                    >
                        <input 
                            type="file" 
                            multiple 
                            accept=".txt,.pdf"
                            onChange={(e) => handleSmeFiles(e.target.files)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <p className="text-gray-600">Drag & drop .txt or .pdf files here, or click to select files.</p>
                    </div>
                    {smeText && (
                        <button
                        onClick={() => setSmeText('')}
                        className="self-start px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600"
                        >
                        Clear Text
                        </button>
                    )}
                    <button onClick={handleParseSme} disabled={isLoading || !smeText.trim()} className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all">
                         {isLoading ? <><LoadingSpinner /><span className="ml-2">Parsing...</span></> : 'Parse & Create Quiz'}
                    </button>
                     <p className="text-sm text-gray-500 mt-2">Convert a block of text from a file or pasted content into an interactive quiz.</p>
                </div>
            );
        case 'notes':
        default:
            return (
                 <div className="flex flex-col gap-6">
                    <div>
                        <h2 className="text-xl font-semibold mb-3">
                        {notesCleaned ? `Cleaned Notes ${noteParts.length > 1 ? `(Part ${currentPartIndex + 1}/${noteParts.length})` : ''}` : 'Your Notes'}
                        </h2>
                        <NoteInput notes={notes} setNotes={setNotes} disabled={notesCleaned} />
                    </div>
                    {!notesCleaned ? (
                        <div>
                        <button
                            onClick={handleCleanNotes}
                            disabled={isCleaning || !notes.trim()}
                            className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                        >
                            {isCleaning ? (
                            <>
                                <LoadingSpinner />
                                <span className="ml-2">Cleaning Notes...</span>
                            </>
                            ) : (
                            'Clean & Prepare Notes'
                            )}
                        </button>
                        <p className="text-sm text-gray-500 mt-2">First, we'll use AI to remove clutter like page numbers and headers from your notes.</p>
                        </div>
                    ) : (
                        <div>
                        {noteParts.length > 1 && (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                            <p className="font-semibold text-blue-800">
                                Large notes loaded. Displaying Part {currentPartIndex + 1} of {noteParts.length}.
                            </p>
                            {currentPartIndex < noteParts.length - 1 && (
                                <button
                                onClick={handleNextPart}
                                className="mt-2 px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600"
                                >
                                Continue to Next Part
                                </button>
                            )}
                            </div>
                        )}
                        <h2 className="text-xl font-semibold mb-3">Generation Tools</h2>
                        <div className="grid grid-cols-2 gap-3">
                            {tools.map(tool => (
                            <button
                                key={tool.type}
                                onClick={() => handleGenerate(tool.type)}
                                disabled={isLoading || !notes.trim()}
                                className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                            >
                                {isLoading ? (
                                <>
                                    <LoadingSpinner />
                                    <span className="ml-2">{notes.length > 16000 ? 'Processing...' : 'Generating...'}</span>
                                </>
                                ) : (
                                tool.label
                                )}
                            </button>
                            ))}
                        </div>
                        </div>
                    )}
                </div>
            )
    }
  }


  return (
    <div className="animate-fade-in-up">
      <header className="flex items-center justify-between mb-6">
        <div>
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-semibold mb-2">
            <ArrowLeftIcon />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-800">
            {subject ? `IGCSE Study Tools: ${subject}` : 'General Note Assistant'}
          </h1>
        </div>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Input and Controls */}
        <div className="flex flex-col gap-4">
            <div className="flex border-b border-gray-200">
                <button onClick={() => setView('notes')} className={`px-4 py-2 text-sm font-medium ${view === 'notes' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Study from Notes</button>
                {subject && <button onClick={() => setView('pastPapers')} className={`px-4 py-2 text-sm font-medium ${view === 'pastPapers' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Past Paper MCQs</button>}
                <button onClick={() => setView('smeParser')} className={`px-4 py-2 text-sm font-medium ${view === 'smeParser' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Parse MCQ Text</button>
            </div>
            <div className="p-1">
              {renderLeftPanel()}
            </div>
        </div>
        
        {/* Right Column: Results */}
        <div>
          <h2 className="text-xl font-semibold mb-3">Generated Content</h2>
          <ResultsDisplay content={generatedContent} />
        </div>
      </div>
    </div>
  );
};

export default Workspace;