
// FIX: Implement the Workspace component. This file was previously empty, causing module resolution errors in App.tsx and "Cannot find name" errors.
import React, { useState, useCallback, useMemo } from 'react';
import { IgcseSubject, GeneratedContent, PastPaperQuestion, IgcseSubjectKey, McqQuestion, IGCSE_SUBJECTS, TrueFalseQuestion } from '../types';
import { SUBJECT_TOPICS } from '../subjectData';
import NoteInput from './NoteInput';
import ResultsDisplay from './ResultsDisplay';
import { generateContentFromGemini, cleanNotesWithGemini, chunkText, findPastPaperMcqs, parseSmeMcqs, generateMoreSmeMcqs, generateTopicMcqs, findSpecificPastPaperQuestions } from '../services/geminiService';
import { LoadingSpinner, ArrowLeftIcon } from './icons';
import HurryStudySession from './HurryStudySession';

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
  // Auto-save cleaned notes
  onAutoSaveCleanedNotes?: (content: string) => void;
}

type WorkspaceView = 'notes' | 'pastPapers' | 'smeParser' | 'hurryStudy';
type PracticeMode = 'mcq' | 'theory';

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
  onSavePastPapers,
  onAutoSaveCleanedNotes
}) => {
  const [view, setView] = useState<WorkspaceView>('notes');
  const [isCleaning, setIsCleaning] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>(''); // For UI feedback
  
  // State for Past Paper MCQ finder - UPDATED to arrays for multi-select
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
  
  const [mcqCount, setMcqCount] = useState(5);
  const [theoryCount, setTheoryCount] = useState(3);
  const [yearRange, setYearRange] = useState(2); // Default to last 2 years (2025-2024)
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('mcq');
  const [questionCriteria, setQuestionCriteria] = useState(''); // e.g. "4 marks"

  const [smeText, setSmeText] = useState('');
  const [isSmeDragging, setIsSmeDragging] = useState(false);


  // Character limit for splitting notes into user-facing parts
  const USER_CHUNK_LIMIT = 30000;

  const handleCleanNotes = async () => {
    if (!notes.trim() || isCleaning) return;

    setIsCleaning(true);
    setSaveStatus('');
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
      
      // Auto-save the cleaned version
      if (onAutoSaveCleanedNotes) {
          onAutoSaveCleanedNotes(cleanedNotes);
          setSaveStatus('Cleaned notes auto-saved to library! 💾');
          setTimeout(() => setSaveStatus(''), 3000);
      }

    } catch (error) {
      console.error("Failed to clean notes:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setGeneratedContent([{type: 'brief-summary', content: `Error: Could not clean your notes.\n${errorMessage}`}]);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleSkipCleaning = () => {
    if (!notes.trim()) return;
    
    // Chunk logic for large manual notes
    if (notes.length > USER_CHUNK_LIMIT) {
        const chunks = chunkText(notes, USER_CHUNK_LIMIT);
        setNoteParts(chunks);
        setCurrentPartIndex(0);
        setNotes(chunks[0]);
    } else {
        setNoteParts([]);
    }
    
    setNotesCleaned(true);
    setGeneratedContent([]);
    
    // Auto-save manually added notes as "cleaned" to consistency
    if (onAutoSaveCleanedNotes) {
        onAutoSaveCleanedNotes(notes);
        setSaveStatus('Notes saved to library! 💾');
        setTimeout(() => setSaveStatus(''), 3000);
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

  const handlePreviousPart = () => {
    const prevIndex = currentPartIndex - 1;
    if (prevIndex >= 0) {
        setCurrentPartIndex(prevIndex);
        setNotes(noteParts[prevIndex]);
        setGeneratedContent([]); // Clear results for the new part
    }
  };

  const handleGenerate = async (type: GeneratedContent['type']) => {
    if (!notes.trim() || isLoading) return;
    setIsLoading(true);
    
    const existingQuestions = generatedContent
      .filter(item => item.type === type)
      .flatMap(item => {
          if (type === 'mcqs' && Array.isArray(item.content)) {
              return (item.content as McqQuestion[]).map(q => q.question);
          }
          if (type === 'true-false' && Array.isArray(item.content)) {
              return (item.content as TrueFalseQuestion[]).map(q => q.statement);
          }
          return [];
      });

    try {
      const result = await generateContentFromGemini(notes, subject, type, existingQuestions);
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
  
  const getCombinedTopicString = () => {
      // If specific subtopics are selected, use them. Otherwise use selected chapters.
      if (selectedSubtopics.length > 0) {
          return selectedSubtopics.join(', ');
      }
      return selectedChapters.join(', ');
  };

  const handleFindMcqs = async () => {
    if (!subject || selectedChapters.length === 0 || isLoading) return;
    setIsLoading(true);
    setGeneratedContent([]);
    try {
        const fullTopic = getCombinedTopicString();
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

  const handleGenerateMcqsFromTopic = async () => {
      if (!subject || selectedChapters.length === 0 || isLoading) return;
      setIsLoading(true);
      setGeneratedContent([]);
      try {
          const fullTopic = getCombinedTopicString();
          const result = await generateTopicMcqs(subject, fullTopic, mcqCount);
          setGeneratedContent([result]);
      } catch (error) {
          console.error("Failed to generate Topic MCQs:", error);
          const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
          setGeneratedContent([{type: 'brief-summary', content: `Error: Could not generate MCQs.\n${errorMessage}`}]);
      } finally {
          setIsLoading(false);
      }
  };
  
  const handleFindTheoryQuestions = async () => {
      if (!subject || selectedChapters.length === 0 || !questionCriteria || isLoading) return;
      setIsLoading(true);
      setGeneratedContent([]);
      try {
          const fullTopic = getCombinedTopicString();
          const result = await findSpecificPastPaperQuestions(subject, fullTopic, questionCriteria, theoryCount, yearRange);
          setGeneratedContent([result]);
          if (subject && onSavePastPapers && Array.isArray(result.content) && result.content.length > 0) {
            onSavePastPapers(subject, result.content as PastPaperQuestion[]);
          }
      } catch (error) {
          console.error("Failed to find specific questions:", error);
          const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
          setGeneratedContent([{type: 'brief-summary', content: `Error: Could not find questions.\n${errorMessage}`}]);
      } finally {
          setIsLoading(false);
      }
  }

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

  const handleGenerateMoreSme = async () => {
    if (!smeText.trim() || isLoading) return;
    setIsLoading(true);
    
    // Gather all existing MCQ questions currently displayed to avoid duplicates
    const existingQuestions = generatedContent
        .filter(c => c.type === 'mcqs')
        .flatMap(c => (c.content as McqQuestion[]).map(q => q.question));

    try {
        const result = await generateMoreSmeMcqs(smeText, existingQuestions);
        // Prepend new results so they appear at the top
        setGeneratedContent(prev => [result, ...prev]);
    } catch (error) {
        console.error("Failed to generate more MCQs:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        setGeneratedContent(prev => [{type: 'brief-summary', content: `Error: Could not generate more questions.\n${errorMessage}`}, ...prev]);
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
    { label: 'Flashcards', type: 'flashcards' as const },
    { label: 'MCQs', type: 'mcqs' as const },
    { label: 'True/False', type: 'true-false' as const },
    { label: 'Past Papers Q&A', type: 'past-papers' as const },
  ];
  
  const generalTools = [
      { label: 'Brief Summary', type: 'brief-summary' as const },
      { label: 'Detailed Summary', type: 'detailed-summary' as const },
      { label: 'Flashcards', type: 'flashcards' as const },
      { label: 'MCQs', type: 'mcqs' as const },
      { label: 'True/False', type: 'true-false' as const },
  ];
  
  const tools = subject ? igcseTools : generalTools;

  // --- Derived state for MCQ topic selection ---
  const subjectKey = Object.keys(IGCSE_SUBJECTS).find(key => IGCSE_SUBJECTS[key as IgcseSubjectKey] === subject) as IgcseSubjectKey | undefined;
  
  const availableChapters = useMemo(() => {
      return (subjectKey && SUBJECT_TOPICS[subjectKey]) || [];
  }, [subjectKey]);

  // Derived available subtopics based on ALL selected chapters
  const availableSubtopics = useMemo(() => {
      return availableChapters
        .filter(c => selectedChapters.includes(c.name))
        .flatMap(c => c.subtopics);
  }, [availableChapters, selectedChapters]);


  const toggleChapter = (chapterName: string) => {
      setSelectedChapters(prev => {
          if (prev.includes(chapterName)) {
              // Unselect: Remove chapter AND remove its subtopics from selection
              const newChapters = prev.filter(c => c !== chapterName);
              // We need to filter subtopics to remove those that belong ONLY to this chapter.
              // Simpler approach: Remove all subtopics belonging to this chapter.
              const chapterObj = availableChapters.find(c => c.name === chapterName);
              if (chapterObj) {
                  setSelectedSubtopics(currentSubs => 
                      currentSubs.filter(sub => !chapterObj.subtopics.includes(sub))
                  );
              }
              return newChapters;
          } else {
              return [...prev, chapterName];
          }
      });
  };

  const toggleSubtopic = (subtopicName: string) => {
      setSelectedSubtopics(prev => {
          if (prev.includes(subtopicName)) {
              return prev.filter(s => s !== subtopicName);
          } else {
              return [...prev, subtopicName];
          }
      });
  };

  const handleSelectAllSubtopics = () => {
      if (selectedSubtopics.length === availableSubtopics.length) {
          setSelectedSubtopics([]);
      } else {
          setSelectedSubtopics(availableSubtopics);
      }
  };
  
  // Check if subject typically has MCQs
  const hasOfficialMcqs = subjectKey && (
      subjectKey.includes('physics') || 
      subjectKey.includes('chemistry') || 
      subjectKey.includes('biology')
  );

  // Check if we have generated MCQs visible
  const hasMcqResults = generatedContent.some(c => c.type === 'mcqs');
  
  // RENDER HURRY STUDY VIEW
  if (view === 'hurryStudy') {
      return (
          <HurryStudySession 
              notes={notes} 
              onBack={() => setView('notes')} 
          />
      );
  }

  const renderLeftPanel = () => {
    switch(view) {
        case 'pastPapers':
            return (
                <div className="flex flex-col gap-4">
                    <h2 className="text-xl font-semibold mb-2">Practice Questions</h2>
                    
                    {/* Mode Tabs */}
                    <div className="flex border-b border-gray-200 mb-2">
                        <button
                            onClick={() => setPracticeMode('mcq')}
                            className={`flex-1 py-2 text-sm font-medium text-center ${practiceMode === 'mcq' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            MCQs
                        </button>
                        <button
                            onClick={() => setPracticeMode('theory')}
                            className={`flex-1 py-2 text-sm font-medium text-center ${practiceMode === 'theory' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Questions
                        </button>
                    </div>

                    {/* Chapter Multi-Select */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Chapters ({selectedChapters.length})</label>
                        <div className="border border-gray-300 rounded-md max-h-48 overflow-y-auto bg-white p-2 shadow-inner">
                            {availableChapters.map(c => (
                                <label key={c.name} className="flex items-start space-x-3 mb-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedChapters.includes(c.name)}
                                        onChange={() => toggleChapter(c.name)}
                                        className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" 
                                    />
                                    <span className="text-sm text-gray-700 leading-tight">{c.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Subtopic Multi-Select */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                             <label className="block text-sm font-medium text-gray-700">Select Subtopics ({selectedSubtopics.length})</label>
                             {availableSubtopics.length > 0 && (
                                 <button 
                                     onClick={handleSelectAllSubtopics}
                                     className="text-xs text-blue-600 hover:text-blue-800 underline"
                                 >
                                     {selectedSubtopics.length === availableSubtopics.length ? 'Deselect All' : 'Select All'}
                                 </button>
                             )}
                        </div>
                        
                        <div className={`border border-gray-300 rounded-md max-h-48 overflow-y-auto bg-white p-2 shadow-inner ${availableSubtopics.length === 0 ? 'bg-gray-100 opacity-70' : ''}`}>
                            {availableSubtopics.length === 0 ? (
                                <p className="text-xs text-gray-500 text-center py-4">Select a chapter to see subtopics</p>
                            ) : (
                                availableSubtopics.map(sub => (
                                    <label key={sub} className="flex items-start space-x-3 mb-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedSubtopics.includes(sub)}
                                            onChange={() => toggleSubtopic(sub)}
                                            className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" 
                                        />
                                        <span className="text-sm text-gray-700 leading-tight">{sub}</span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>

                    {practiceMode === 'mcq' ? (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="q_count" className="block text-sm font-medium text-gray-700">Questions</label>
                                    <input 
                                        type="number" 
                                        id="q_count"
                                        value={mcqCount}
                                        min="1"
                                        max="20"
                                        onChange={(e) => setMcqCount(parseInt(e.target.value, 10))}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white text-gray-900"
                                    />
                                </div>
                                {hasOfficialMcqs && (
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
                                )}
                            </div>

                            {hasOfficialMcqs ? (
                                <button onClick={handleFindMcqs} disabled={isLoading || selectedChapters.length === 0} className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all">
                                    {isLoading ? <><LoadingSpinner /><span className="ml-2">Finding...</span></> : 'Find Past Paper MCQs'}
                                </button>
                            ) : (
                                <>
                                    <button onClick={handleGenerateMcqsFromTopic} disabled={isLoading || selectedChapters.length === 0} className="w-full flex items-center justify-center px-4 py-3 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all">
                                        {isLoading ? <><LoadingSpinner /><span className="ml-2">Generating...</span></> : 'Convert Topic to MCQs'}
                                    </button>
                                    <p className="text-xs text-gray-500 mt-2">
                                        This subject typically doesn't have a pure MCQ paper. We will generate MCQs from the theory content for practice.
                                    </p>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                             <div>
                                <label htmlFor="criteria" className="block text-sm font-medium text-gray-700">Question Type/Criteria</label>
                                <input 
                                    type="text" 
                                    id="criteria"
                                    value={questionCriteria}
                                    onChange={(e) => setQuestionCriteria(e.target.value)}
                                    placeholder="e.g. 4 marks, 7 marks, Map skills..."
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white text-gray-900"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="theory_count" className="block text-sm font-medium text-gray-700">Questions</label>
                                    <input 
                                        type="number" 
                                        id="theory_count"
                                        value={theoryCount}
                                        min="1"
                                        max="10"
                                        onChange={(e) => setTheoryCount(parseInt(e.target.value, 10))}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white text-gray-900"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="year_range_theory" className="block text-sm font-medium text-gray-700">Year Range</label>
                                    <select 
                                            id="year_range_theory"
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
                            <button onClick={handleFindTheoryQuestions} disabled={isLoading || selectedChapters.length === 0 || !questionCriteria} className="w-full flex items-center justify-center px-4 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all">
                                {isLoading ? <><LoadingSpinner /><span className="ml-2">Searching...</span></> : 'Find Specific Questions'}
                            </button>
                             <p className="text-xs text-gray-500 mt-2">
                                Find questions matching specific criteria (e.g. marks) for these topics.
                            </p>
                        </>
                    )}
                </div>
            );
        case 'smeParser':
            return (
                <div className="flex flex-col gap-4">
                    <h2 className="text-xl font-semibold mb-2">Quiz from Text/File</h2>
                    <textarea
                        value={smeText}
                        onChange={(e) => setSmeText(e.target.value)}
                        placeholder="Paste study notes or MCQs (from a past paper/website) here, or upload a file below..."
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
                         {isLoading ? <><LoadingSpinner /><span className="ml-2">Processing...</span></> : 'Create Quiz'}
                    </button>
                    {hasMcqResults && smeText && (
                        <button 
                            onClick={handleGenerateMoreSme} 
                            disabled={isLoading}
                            className="w-full flex items-center justify-center px-4 py-3 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                        >
                            {isLoading ? <><LoadingSpinner /><span className="ml-2">Processing...</span></> : 'Quiz on New Topics (Different Questions)'}
                        </button>
                    )}
                     <p className="text-sm text-gray-500 mt-2">Convert your notes or existing questions into an interactive quiz.</p>
                </div>
            );
        case 'notes':
        default:
            return (
                 <div className="flex flex-col gap-6">
                    <div>
                        <div className="flex justify-between items-end mb-3">
                            <h2 className="text-xl font-semibold">
                            {notesCleaned ? `Cleaned Notes ${noteParts.length > 1 ? `(Part ${currentPartIndex + 1}/${noteParts.length})` : ''}` : 'Your Notes'}
                            </h2>
                            {saveStatus && (
                                <span className="text-sm font-medium text-green-600 animate-fade-in-up">
                                    {saveStatus}
                                </span>
                            )}
                        </div>
                        <NoteInput notes={notes} setNotes={setNotes} disabled={notesCleaned} />
                    </div>
                    {!notesCleaned ? (
                        <div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={handleCleanNotes}
                                disabled={isCleaning || !notes.trim()}
                                className="flex-1 flex items-center justify-center px-4 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                            >
                                {isCleaning ? (
                                <>
                                    <LoadingSpinner />
                                    <span className="ml-2">Cleaning & Saving Notes...</span>
                                </>
                                ) : (
                                'Clean & Prepare Notes'
                                )}
                            </button>
                            <button
                                onClick={handleSkipCleaning}
                                disabled={isCleaning || !notes.trim()}
                                className="flex-shrink-0 px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Skip Cleaning
                            </button>
                        </div>
                        <p className="text-sm text-gray-500 mt-2">
                             Use "Clean & Prepare" to remove clutter with AI, or "Skip Cleaning" if your notes are already ready. Both save to your library.
                        </p>
                        </div>
                    ) : (
                        <div>
                        {noteParts.length > 1 && (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="font-semibold text-blue-800 text-center mb-2">
                                    Large notes loaded.
                                </p>
                                <div className="flex justify-between items-center">
                                    <button
                                        onClick={handlePreviousPart}
                                        disabled={currentPartIndex === 0}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                                            currentPartIndex === 0
                                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                            : 'bg-white border-blue-300 text-blue-600 hover:bg-blue-50'
                                        }`}
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm text-blue-800 font-medium">
                                        Part {currentPartIndex + 1} of {noteParts.length}
                                    </span>
                                    <button
                                        onClick={handleNextPart}
                                        disabled={currentPartIndex === noteParts.length - 1}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                                            currentPartIndex === noteParts.length - 1
                                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                            : 'bg-blue-600 border-transparent text-white hover:bg-blue-700'
                                        }`}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-bold text-indigo-900">Hurry-Study Mode</h3>
                                    <p className="text-sm text-indigo-700">Interactive topic breakdown, assessment, and grading.</p>
                                </div>
                                <button 
                                    onClick={() => setView('hurryStudy')}
                                    className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md transition-all"
                                >
                                    Start Hurry-Study
                                </button>
                            </div>
                        </div>

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
                                    <span className="ml-2">{notes.length > 32000 ? 'Processing...' : 'Generating...'}</span>
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
                    {subject && <button onClick={() => setView('pastPapers')} className={`px-4 py-2 text-sm font-medium ${view === 'pastPapers' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Practice Questions</button>}
                    <button onClick={() => setView('smeParser')} className={`px-4 py-2 text-sm font-medium ${view === 'smeParser' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Quiz from Text/File</button>
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
