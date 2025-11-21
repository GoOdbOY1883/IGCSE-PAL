import React, { useCallback, useState } from 'react';

// FIX: Add a global declaration for `pdfjsLib` to resolve the "Cannot find name 'pdfjsLib'" error.
// This informs TypeScript that `pdfjsLib` is available in the global scope (e.g., from a script tag).
declare var pdfjsLib: any;

interface NoteInputProps {
  notes: string;
  // FIX: Updated the type for the `setNotes` prop to `React.Dispatch<React.SetStateAction<string>>`.
  // This fixes type errors when using a functional update for the state.
  setNotes: React.Dispatch<React.SetStateAction<string>>;
  disabled?: boolean;
}

const NoteInput: React.FC<NoteInputProps> = ({ notes, setNotes, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = async (file: File) => {
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
        setNotes(prev => `${prev}\n\n--- Appended from ${file.name} ---\n${textContent}`);
      };
      reader.readAsArrayBuffer(file);
    } else { // txt files
      const text = await file.text();
      setNotes(prev => `${prev}\n\n--- Appended from ${file.name} ---\n${text}`);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (files) {
      Array.from(files).forEach(handleFile);
    }
  };
  
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, []);


  return (
    <div className="flex flex-col gap-4">
    <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Type or paste your notes here..."
        className="w-full h-64 p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-gray-100"
        disabled={disabled}
    />
    <div 
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative p-6 border-2 border-dashed rounded-lg text-center transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'} ${disabled ? 'bg-gray-100' : ''}`}
    >
        <input 
            type="file" 
            multiple 
            accept=".txt,.pdf"
            onChange={(e) => handleFiles(e.target.files)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={disabled}
        />
        <p className="text-gray-600">Drag & drop .txt or .pdf files here, or click to select files.</p>
    </div>
    {notes && !disabled && (
        <button
        onClick={() => setNotes('')}
        className="self-start px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600"
        >
        Clear Notes
        </button>
    )}
    </div>
  );
};

export default NoteInput;