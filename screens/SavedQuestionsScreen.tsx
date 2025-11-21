import React from 'react';
import { SavedPastPapers } from '../types';
import { ArrowLeftIcon } from '../components/icons';
import { PastPaperDisplay } from '../components/ResultsDisplay';

interface SavedQuestionsScreenProps {
  savedPapers: SavedPastPapers;
  onBack: () => void;
  onClear: () => void;
}

const SavedQuestionsScreen: React.FC<SavedQuestionsScreenProps> = ({ savedPapers, onBack, onClear }) => {
  const subjects = Object.keys(savedPapers).filter(subject => savedPapers[subject]?.length > 0);

  return (
    <div className="animate-fade-in-up">
      <header className="flex items-center justify-between mb-6">
        <div>
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-semibold mb-2">
            <ArrowLeftIcon />
            Back to Welcome
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Saved Past Paper Q&A</h1>
        </div>
        {subjects.length > 0 && (
          <button
            onClick={onClear}
            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-colors"
          >
            Clear All Saved Q&A
          </button>
        )}
      </header>
      
      {subjects.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">You haven't saved any past paper questions yet.</p>
          <p className="text-gray-500 mt-2">Go to the IGCSE Study Tools, generate some 'Past Papers Q&A', and they will appear here automatically.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {subjects.map(subject => (
            <div key={subject} className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-700 mb-4">{subject}</h2>
              <PastPaperDisplay questions={savedPapers[subject]} showTitle={false} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedQuestionsScreen;
