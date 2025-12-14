
import React, { useState, useCallback } from 'react';
import { ArrowLeftIcon, LoadingSpinner } from '../components/icons';
import { editImageWithGemini } from '../services/geminiService';

interface ImageEditorScreenProps {
  onBack: () => void;
}

const ImageEditorScreen: React.FC<ImageEditorScreenProps> = ({ onBack }) => {
  const [image, setImage] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target?.result as string);
        setEditedImage(null);
      };
      reader.readAsDataURL(file);
    } else {
        alert("Please upload a valid image file.");
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      handleFile(files[0]);
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

  const handleEdit = async () => {
    if (!image || !prompt.trim() || isLoading) return;
    setIsLoading(true);
    setEditedImage(null);

    try {
        // Extract base64 data and mime type
        const matches = image.match(/^data:(.+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            throw new Error("Invalid image format");
        }
        const mimeType = matches[1];
        const base64Data = matches[2];

        const resultBase64 = await editImageWithGemini(base64Data, mimeType, prompt);
        setEditedImage(`data:image/png;base64,${resultBase64}`);
    } catch (error) {
        console.error(error);
        alert("Failed to edit image. Please try again.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <header className="flex items-center justify-between mb-8">
        <div>
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-semibold mb-2">
            <ArrowLeftIcon />
            Back to Home
          </button>
          <h1 className="text-3xl font-bold text-gray-800">AI Image Editor</h1>
          <p className="text-gray-600">Powered by Gemini 2.5 Flash Image. Upload an image and describe how to change it.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Input */}
        <div className="flex flex-col gap-6">
            {!image ? (
                 <div 
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    className={`h-96 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center p-8 transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-gray-50'}`}
                >
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <p className="text-lg font-medium text-gray-700">Drag & Drop an image here</p>
                    <p className="text-gray-500 mb-6">or click to upload</p>
                    <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => handleFiles(e.target.files)}
                        className="hidden"
                        id="image-upload"
                    />
                    <label 
                        htmlFor="image-upload"
                        className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors"
                    >
                        Select Image
                    </label>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <div className="relative rounded-2xl overflow-hidden shadow-md border border-gray-200 bg-gray-100 max-h-[500px] flex items-center justify-center">
                        <img src={image} alt="Original" className="max-w-full max-h-full object-contain" />
                        <button 
                            onClick={() => { setImage(null); setEditedImage(null); }}
                            className="absolute top-2 right-2 p-2 bg-white/80 hover:bg-white text-gray-700 rounded-full shadow-sm backdrop-blur-sm transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">How should we change this image?</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder='e.g., "Add a retro filter", "Remove the person in background"'
                                className="flex-1 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                            />
                            <button 
                                onClick={handleEdit}
                                disabled={isLoading || !prompt.trim()}
                                className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center"
                            >
                                {isLoading ? <LoadingSpinner /> : 'Generate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Right: Output */}
        <div className="flex flex-col gap-6">
            <h2 className="text-xl font-bold text-gray-800">Result</h2>
            <div className={`h-[500px] border-2 rounded-2xl flex items-center justify-center p-4 bg-gray-50 ${editedImage ? 'border-green-200 bg-green-50' : 'border-dashed border-gray-200'}`}>
                {isLoading ? (
                    <div className="text-center">
                        <LoadingSpinner />
                        <p className="mt-4 text-indigo-600 font-medium animate-pulse">Processing image...</p>
                        <p className="text-sm text-gray-500 mt-1">This uses the nano banana powered Gemini 2.5 Flash Image model.</p>
                    </div>
                ) : editedImage ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                        <img src={editedImage} alt="Edited Result" className="max-w-full max-h-full object-contain rounded-lg shadow-sm" />
                        <a 
                            href={editedImage} 
                            download="edited-image.png"
                            className="absolute bottom-4 right-4 px-4 py-2 bg-white text-gray-800 font-bold rounded-lg shadow-md hover:bg-gray-50 transition-all flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                        </a>
                    </div>
                ) : (
                    <div className="text-center text-gray-400">
                        <p>Edited image will appear here.</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ImageEditorScreen;
