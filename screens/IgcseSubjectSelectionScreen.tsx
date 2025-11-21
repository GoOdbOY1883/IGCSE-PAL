import React from 'react';
import { IGCSE_SUBJECTS, IgcseSubject, IgcseSubjectKey } from '../types';
import { ArrowLeftIcon } from '../components/icons';

interface IgcseSubjectSelectionScreenProps {
  onSubjectSelect: (subjectKey: IgcseSubjectKey, subjectName: IgcseSubject) => void;
  onBack: () => void;
}

const IgcseSubjectSelectionScreen: React.FC<IgcseSubjectSelectionScreenProps> = ({ onSubjectSelect, onBack }) => {
  return (
    <div className="animate-fade-in-up">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 font-semibold">
        <ArrowLeftIcon />
        Back to Mode Selection
      </button>
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-800">Select IGCSE Subject</h1>
        <p className="text-lg text-gray-600 mt-2">Choose your subject to begin generating study materials.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {(Object.keys(IGCSE_SUBJECTS) as IgcseSubjectKey[]).map((key) => (
          <button
            key={key}
            onClick={() => onSubjectSelect(key, IGCSE_SUBJECTS[key])}
            className="p-4 h-32 flex items-center justify-center text-center font-semibold bg-white text-blue-700 rounded-lg shadow-md border border-gray-200 hover:shadow-lg hover:border-blue-500 hover:-translate-y-1 transition-all duration-200"
          >
            {IGCSE_SUBJECTS[key]}
          </button>
        ))}
      </div>
    </div>
  );
};

export default IgcseSubjectSelectionScreen;
