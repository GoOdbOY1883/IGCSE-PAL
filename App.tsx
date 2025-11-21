import React, { useState, useEffect } from 'react';
import { AppMode, GeneratedContent, IgcseSubject, IgcseSubjectKey, PastPaperQuestion, SavedPastPapers } from './types';
import WelcomeScreen from './screens/WelcomeScreen';
import IgcseSubjectSelectionScreen from './screens/IgcseSubjectSelectionScreen';
import Workspace from './components/Workspace';
import SavedQuestionsScreen from './screens/SavedQuestionsScreen';

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('welcome');
  const [subject, setSubject] = useState<IgcseSubject | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Lifted state for persistence
  const [notesCleaned, setNotesCleaned] = useState<boolean>(false);
  const [noteParts, setNoteParts] = useState<string[]>([]);
  const [currentPartIndex, setCurrentPartIndex] = useState<number>(0);

  // State for saved Past Paper questions
  const [savedPastPapers, setSavedPastPapers] = useState<SavedPastPapers>({});

  const WORKSPACE_STATE_KEY = 'igcseStudyPalWorkspaceState';
  const SAVED_PAPERS_KEY = 'igcseStudyPalSavedPapers';

  // Load state from localStorage on initial mount
  useEffect(() => {
    // Load workspace state
    const savedStateJSON = localStorage.getItem(WORKSPACE_STATE_KEY);
    if (savedStateJSON) {
        try {
            const savedState = JSON.parse(savedStateJSON);
            if (savedState && (savedState.appMode === 'igcse-workspace' || savedState.appMode === 'general-workspace')) {
                setAppMode(savedState.appMode);
                setSubject(savedState.subject || null);
                setNotes(savedState.notes || '');
                setGeneratedContent(savedState.generatedContent || []);
                setNotesCleaned(savedState.notesCleaned || false);
                setNoteParts(savedState.noteParts || []);
                setCurrentPartIndex(savedState.currentPartIndex || 0);
            }
        } catch (error) {
            console.error("Failed to parse saved state from localStorage:", error);
            localStorage.removeItem(WORKSPACE_STATE_KEY);
        }
    }
    
    // Load saved past papers
    const savedPapersJSON = localStorage.getItem(SAVED_PAPERS_KEY);
    if (savedPapersJSON) {
        try {
            const savedData = JSON.parse(savedPapersJSON);
            setSavedPastPapers(savedData || {});
        } catch (error) {
            console.error("Failed to parse saved papers from localStorage:", error);
            localStorage.removeItem(SAVED_PAPERS_KEY);
        }
    }
  }, []);

  // Save workspace state to localStorage whenever it changes
  useEffect(() => {
    if (appMode === 'igcse-workspace' || appMode === 'general-workspace') {
        const stateToSave = {
            appMode,
            subject,
            notes,
            generatedContent,
            notesCleaned,
            noteParts,
            currentPartIndex,
        };
        localStorage.setItem(WORKSPACE_STATE_KEY, JSON.stringify(stateToSave));
    } else {
        localStorage.removeItem(WORKSPACE_STATE_KEY);
    }
  }, [appMode, subject, notes, generatedContent, notesCleaned, noteParts, currentPartIndex]);
  
  // Save past papers to localStorage when they change
  useEffect(() => {
      localStorage.setItem(SAVED_PAPERS_KEY, JSON.stringify(savedPastPapers));
  }, [savedPastPapers]);


  const handleModeSelect = (mode: 'igcse' | 'general') => {
    if (mode === 'igcse') {
      setAppMode('igcse-subject-select');
    } else {
      setAppMode('general-workspace');
      setSubject(null);
    }
    setNotes('');
    setGeneratedContent([]);
    setNotesCleaned(false);
    setNoteParts([]);
    setCurrentPartIndex(0);
  };
  
  const handleViewSaved = () => {
      setAppMode('saved-questions');
  }

  const handleSubjectSelect = (subjectKey: IgcseSubjectKey, subjectName: IgcseSubject) => {
    setSubject(subjectName);
    setAppMode('igcse-workspace');
    setNotes('');
    setGeneratedContent([]);
    setNotesCleaned(false);
    setNoteParts([]);
    setCurrentPartIndex(0);
  };
  
  const handleBackToWelcome = () => {
    setAppMode('welcome');
    setSubject(null);
    setNotes('');
    setGeneratedContent([]);
    setNotesCleaned(false);
    setNoteParts([]);
    setCurrentPartIndex(0);
  }

  const handleBackToSubjectSelect = () => {
    setAppMode('igcse-subject-select');
    setSubject(null);
    setNotes('');
    setGeneratedContent([]);
    setNotesCleaned(false);
    setNoteParts([]);
    setCurrentPartIndex(0);
  }

  const handleSavePastPapers = (subject: IgcseSubject, questions: PastPaperQuestion[]) => {
      setSavedPastPapers(prev => {
        const existingQuestions = prev[subject] || [];
        // Prevent duplicates by checking question text
        const newQuestions = questions.filter(q => 
            !existingQuestions.some(eq => eq.question === q.question)
        );

        if (newQuestions.length === 0) return prev;

        return {
          ...prev,
          [subject]: [...existingQuestions, ...newQuestions]
        };
      });
  };

  const handleClearSavedPapers = () => {
      if (window.confirm("Are you sure you want to delete all saved questions? This action cannot be undone.")) {
          setSavedPastPapers({});
      }
  };


  const renderScreen = () => {
    switch (appMode) {
      case 'welcome':
        return <WelcomeScreen onModeSelect={handleModeSelect} onViewSaved={handleViewSaved} />;
      
      case 'igcse-subject-select':
        return <IgcseSubjectSelectionScreen onSubjectSelect={handleSubjectSelect} onBack={handleBackToWelcome}/>;

      case 'saved-questions':
        return <SavedQuestionsScreen savedPapers={savedPastPapers} onClear={handleClearSavedPapers} onBack={handleBackToWelcome} />;

      case 'igcse-workspace':
      case 'general-workspace':
        return (
          <Workspace
            subject={subject}
            notes={notes}
            setNotes={setNotes}
            generatedContent={generatedContent}
            setGeneratedContent={setGeneratedContent}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            onBack={subject ? handleBackToSubjectSelect : handleBackToWelcome}
            notesCleaned={notesCleaned}
            setNotesCleaned={setNotesCleaned}
            noteParts={noteParts}
            setNoteParts={setNoteParts}
            currentPartIndex={currentPartIndex}
            setCurrentPartIndex={setCurrentPartIndex}
            onSavePastPapers={handleSavePastPapers}
          />
        );

      default:
        return <WelcomeScreen onModeSelect={handleModeSelect} onViewSaved={handleViewSaved} />;
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        {renderScreen()}
      </div>
    </main>
  );
};

export default App;