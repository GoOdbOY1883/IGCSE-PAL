
import React from 'react';
import { SavedNote } from '../types';
import { ArrowLeftIcon } from '../components/icons';

interface SavedNotesScreenProps {
  savedNotes: SavedNote[];
  onLoad: (note: SavedNote) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

const SavedNotesScreen: React.FC<SavedNotesScreenProps> = ({ savedNotes, onLoad, onDelete, onBack }) => {
  return (
    <div className="animate-fade-in-up">
      <header className="flex items-center justify-between mb-8">
        <div>
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-semibold mb-2">
            <ArrowLeftIcon />
            Back to Welcome
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Saved Notes Library</h1>
        </div>
      </header>

      {savedNotes.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-500 text-lg">Your library is empty.</p>
          <p className="text-gray-400 mt-2">When you clean your notes in the workspace, they will automatically appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedNotes.map((note) => (
            <div key={note.id} className="bg-white p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow flex flex-col h-64">
              <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-gray-800 truncate pr-2" title={note.title}>{note.title}</h3>
                </div>
                <div className="flex items-center gap-2 mb-3">
                     <span className={`text-xs font-bold px-2 py-1 rounded-full ${note.subject ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                        {note.subject || 'General'}
                     </span>
                     <span className="text-xs text-gray-500">
                        {new Date(note.date).toLocaleDateString()}
                     </span>
                </div>
                <p className="text-gray-600 text-sm line-clamp-4">
                  {note.content}
                </p>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => onLoad(note)}
                  className="flex-1 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Open
                </button>
                <button
                  onClick={() => onDelete(note.id)}
                  className="px-4 py-2 bg-red-50 text-red-600 font-semibold rounded-lg hover:bg-red-100 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedNotesScreen;
