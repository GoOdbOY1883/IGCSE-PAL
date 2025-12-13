
import React, { useState, useEffect } from 'react';
import { AppMode, GeneratedContent, IgcseSubject, IgcseSubjectKey, PastPaperQuestion, SavedPastPapers, SavedNote } from './types';
import { chunkText } from './services/geminiService';
import WelcomeScreen from './screens/WelcomeScreen';
import IgcseSubjectSelectionScreen from './screens/IgcseSubjectSelectionScreen';
import Workspace from './components/Workspace';
import SavedQuestionsScreen from './screens/SavedQuestionsScreen';
import SavedNotesScreen from './screens/SavedNotesScreen';

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('welcome');
  const [subject, setSubject] = useState<IgcseSubject | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Lifted state for persistence (Workspace specific)
  const [notesCleaned, setNotesCleaned] = useState<boolean>(false);
  const [noteParts, setNoteParts] = useState<string[]>([]);
  const [currentPartIndex, setCurrentPartIndex] = useState<number>(0);

  // State for saved items
  const [savedPastPapers, setSavedPastPapers] = useState<SavedPastPapers>({});
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);

  const SAVED_PAPERS_KEY = 'igcseStudyPalSavedPapers';
  const SAVED_NOTES_KEY = 'igcseStudyPalSavedNotes';

  // Load saved data from localStorage on initial mount
  useEffect(() => {
    // Load saved past papers
    const savedPapersJSON = localStorage.getItem(SAVED_PAPERS_KEY);
    if (savedPapersJSON) {
        try {
            const savedData = JSON.parse(savedPapersJSON);
            setSavedPastPapers(savedData || {});
        } catch (error) {
            console.error("Failed to parse saved papers:", error);
        }
    }

    // Load saved notes
    const savedNotesJSON = localStorage.getItem(SAVED_NOTES_KEY);
    if (savedNotesJSON) {
        try {
            const savedData = JSON.parse(savedNotesJSON);
            setSavedNotes(savedData || []);
        } catch (error) {
            console.error("Failed to parse saved notes:", error);
        }
    }
  }, []);
  
  // Persist saved items when they change
  useEffect(() => {
      localStorage.setItem(SAVED_PAPERS_KEY, JSON.stringify(savedPastPapers));
  }, [savedPastPapers]);

  useEffect(() => {
      localStorage.setItem(SAVED_NOTES_KEY, JSON.stringify(savedNotes));
  }, [savedNotes]);


  const handleModeSelect = (mode: 'igcse' | 'general') => {
    if (mode === 'igcse') {
      setAppMode('igcse-subject-select');
    } else {
      setAppMode('general-workspace');
      setSubject(null);
    }
    resetWorkspace();
  };
  
  const handleViewSaved = () => {
      setAppMode('saved-questions');
  }

  const handleViewSavedNotes = () => {
      setAppMode('saved-notes');
  }

  const handleSubjectSelect = (subjectKey: IgcseSubjectKey, subjectName: IgcseSubject) => {
    setSubject(subjectName);
    setAppMode('igcse-workspace');
    resetWorkspace();
  };
  
  const resetWorkspace = () => {
    setNotes('');
    setGeneratedContent([]);
    setNotesCleaned(false);
    setNoteParts([]);
    setCurrentPartIndex(0);
  };
  
  const handleBackToWelcome = () => {
    setAppMode('welcome');
    setSubject(null);
    resetWorkspace();
  }

  const handleBackToSubjectSelect = () => {
    setAppMode('igcse-subject-select');
    setSubject(null);
    resetWorkspace();
  }

  // --- Saved Questions Logic ---
  const handleSavePastPapers = (subject: IgcseSubject, questions: PastPaperQuestion[]) => {
      setSavedPastPapers(prev => {
        const existingQuestions = prev[subject] || [];
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
      if (window.confirm("Are you sure you want to delete all saved questions?")) {
          setSavedPastPapers({});
      }
  };

  // --- Saved Notes Logic ---
  const handleAutoSaveCleanedNotes = (content: string) => {
      const newNote: SavedNote = {
          id: Date.now().toString(),
          title: `${subject || 'General'} Notes - ${new Date().toLocaleTimeString()}`,
          subject: subject,
          content: content,
          date: new Date().toISOString()
      };
      setSavedNotes(prev => [newNote, ...prev]);
  };

  const handleDeleteSavedNote = (id: string) => {
      if(window.confirm("Delete this saved note?")) {
          setSavedNotes(prev => prev.filter(n => n.id !== id));
      }
  };

  const handleLoadSavedNote = (note: SavedNote) => {
      setSubject(note.subject);
      
      const USER_CHUNK_LIMIT = 30000;
      if (note.content.length > USER_CHUNK_LIMIT) {
          const chunks = chunkText(note.content, USER_CHUNK_LIMIT);
          setNoteParts(chunks);
          setNotes(chunks[0]);
      } else {
          setNoteParts([note.content]);
          setNotes(note.content);
      }
      
      setNotesCleaned(true);
      setCurrentPartIndex(0);
      setGeneratedContent([]);
      
      if (note.subject) {
          setAppMode('igcse-workspace');
      } else {
          setAppMode('general-workspace');
      }
  };


  const renderScreen = () => {
    switch (appMode) {
      case 'welcome':
        return <WelcomeScreen onModeSelect={handleModeSelect} onViewSaved={handleViewSaved} onViewSavedNotes={handleViewSavedNotes} />;
      
      case 'igcse-subject-select':
        return <IgcseSubjectSelectionScreen onSubjectSelect={handleSubjectSelect} onBack={handleBackToWelcome}/>;

      case 'saved-questions':
        return <SavedQuestionsScreen savedPapers={savedPastPapers} onClear={handleClearSavedPapers} onBack={handleBackToWelcome} />;

      case 'saved-notes':
        return <SavedNotesScreen savedNotes={savedNotes} onLoad={handleLoadSavedNote} onDelete={handleDeleteSavedNote} onBack={handleBackToWelcome} />;

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
            onAutoSaveCleanedNotes={handleAutoSaveCleanedNotes}
          />
        );

      default:
        return <WelcomeScreen onModeSelect={handleModeSelect} onViewSaved={handleViewSaved} onViewSavedNotes={handleViewSavedNotes} />;
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
