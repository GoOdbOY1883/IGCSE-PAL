import React from 'react';

interface WelcomeScreenProps {
  onModeSelect: (mode: 'igcse' | 'general') => void;
  onViewSaved: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onModeSelect, onViewSaved }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-4">
      <h1 className="text-5xl md:text-6xl font-extrabold mb-4 text-gray-800 animate-fade-in-up">
        IGCSE Study Pal
      </h1>
      <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto" style={{ animationDelay: '0.2s', animationFillMode: 'backwards' }}>
        Your AI-powered assistant for IGCSE prep and general note-taking. Choose your path to get started.
      </p>
      <div className="w-full max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => onModeSelect('igcse')}
            className="p-8 bg-white border border-gray-200 rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group"
          >
            <h2 className="text-2xl font-bold text-blue-600 mb-2">IGCSE Study Tools</h2>
            <p className="text-gray-600">
              Generate summaries, quizzes, and find past paper questions for IGCSE Pakistan subjects.
            </p>
          </button>
          <button
            onClick={() => onModeSelect('general')}
            className="p-8 bg-white border border-gray-200 rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group"
          >
            <h2 className="text-2xl font-bold text-teal-600 mb-2">General Note Assistant</h2>
            <p className="text-gray-600">
              For any topic or subject. Upload your notes to create summaries and practice quizzes.
            </p>
          </button>
        </div>
        <div className="mt-8">
            <button
                onClick={onViewSaved}
                className="w-full p-6 bg-gray-50 border border-gray-300 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-px transition-all duration-300 group"
            >
                <h2 className="text-xl font-bold text-gray-700">View Saved Q&A</h2>
                <p className="text-gray-600 mt-1">Review your saved past paper questions.</p>
            </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;