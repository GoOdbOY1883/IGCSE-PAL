
import React, { useState } from 'react';
import { GeneratedContent, McqQuestion, PastPaperQuestion, TrueFalseQuestion, Difficulty, SourcedMcqQuestion, PastPaperGradingResult } from '../types';
import { gradePastPaperAnswer } from '../services/geminiService';
import { LoadingSpinner } from './icons';

interface ResultsDisplayProps {
  content: GeneratedContent[];
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ content }) => {
  if (content.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg p-8">
        <p className="text-gray-500">Your generated content will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-[75vh] overflow-y-auto pr-2">
      {content.map((item, index) => (
        <div key={index} className="bg-white p-6 rounded-lg shadow-md border border-gray-200 animate-fade-in-up">
          {renderContent(item)}
        </div>
      ))}
    </div>
  );
};

const renderContent = (item: GeneratedContent) => {
  switch (item.type) {
    case 'brief-summary':
      return <SummaryDisplay title="Brief Summary" text={item.content} />;
    case 'detailed-summary':
      return <SummaryDisplay title="Detailed Summary" text={item.content} />;
    case 'mcqs':
      return <McqDisplay questions={item.content} />;
    case 'sourced-mcqs':
      return <SourcedMcqDisplay questions={item.content} />;
    case 'true-false':
      return <TrueFalseDisplay questions={item.content} />;
    case 'past-papers':
        return <InteractivePastPaperDisplay questions={item.content} />;
    default:
      return null;
  }
};

const SummaryDisplay: React.FC<{title: string, text: string}> = ({ title, text }) => (
    <div>
        <h3 className="text-xl font-bold text-gray-800 mb-3">{title}</h3>
        <MarkdownRenderer content={text} />
    </div>
);

const SourcedMcqDisplay: React.FC<{questions: SourcedMcqQuestion[]}> = ({ questions }) => {
    const [answers, setAnswers] = useState<{[key: number]: string}>({});
    const [submitted, setSubmitted] = useState(false);

    const getButtonClass = (qIndex: number, option: string) => {
        if (!submitted) return 'bg-white hover:bg-gray-100';
        const question = questions[qIndex];
        if (option === question.answer) return 'bg-green-100 border-green-400';
        if (option === answers[qIndex]) return 'bg-red-100 border-red-400';
        return 'bg-gray-50';
    }

    if (!questions || questions.length === 0) {
        return (
            <div className="text-center py-8">
                <p className="text-gray-500">No matching questions found.</p>
            </div>
        );
    }

    return (
        <div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">Past Paper MCQs</h3>
            {questions.map((q, i) => (
                <div key={i} className="mb-6 p-4 border rounded-lg bg-gray-50">
                    <p className="font-semibold mb-2">{i+1}. {q.question}</p>
                    <div className="flex flex-col gap-2">
                        {q.options.map((opt, optIndex) => (
                            <button key={optIndex} onClick={() => !submitted && setAnswers(p => ({...p, [i]: opt}))} 
                                className={`p-2 text-left border rounded-md ${getButtonClass(i, opt)} ${!submitted ? 'cursor-pointer' : 'cursor-default'} ${answers[i] === opt && !submitted ? 'ring-2 ring-blue-500' : ''}`}>
                                {opt}
                            </button>
                        ))}
                    </div>
                     {submitted && (
                        <div className="mt-3 pt-3 border-t text-sm text-gray-600">
                            <p><strong>Correct Answer:</strong> {q.answer}</p>
                            <p className="mt-1"><strong>Source:</strong> {q.sourcePaper}</p>
                            <a href={q.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                View Source
                            </a>
                        </div>
                    )}
                </div>
            ))}
            <button onClick={() => setSubmitted(true)} disabled={submitted} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400">Check Answers</button>
        </div>
    );
}


const McqDisplay: React.FC<{questions: McqQuestion[]}> = ({ questions }) => {
    const [answers, setAnswers] = useState<{[key: number]: string}>({});
    const [submitted, setSubmitted] = useState(false);

    const getButtonClass = (qIndex: number, option: string) => {
        if (!submitted) return 'bg-white hover:bg-gray-100';
        const question = questions[qIndex];
        if (option === question.answer) return 'bg-green-100 border-green-400';
        if (option === answers[qIndex]) return 'bg-red-100 border-red-400';
        return 'bg-gray-50';
    }

    if (!questions || questions.length === 0) {
        return (
             <div className="text-center py-8">
                <h3 className="text-xl font-bold text-gray-800 mb-3">Multiple-Choice Quiz</h3>
                <p className="text-red-500 bg-red-50 p-3 rounded-lg border border-red-200 inline-block">
                    No questions could be generated from the text. <br/>
                    Please try providing clearer notes or a longer text segment.
                </p>
            </div>
        );
    }

    return (
        <div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">Multiple-Choice Quiz</h3>
            {questions.map((q, i) => (
                <div key={i} className="mb-6">
                    <p className="font-semibold mb-2">{i+1}. {q.question}</p>
                    <div className="flex flex-col gap-2">
                        {q.options.map((opt, optIndex) => (
                            <button key={optIndex} onClick={() => !submitted && setAnswers(p => ({...p, [i]: opt}))} 
                                className={`p-2 text-left border rounded-md ${getButtonClass(i, opt)} ${!submitted ? 'cursor-pointer' : 'cursor-default'} ${answers[i] === opt && !submitted ? 'ring-2 ring-blue-500' : ''}`}>
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
            <button onClick={() => setSubmitted(true)} disabled={submitted} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400">Check Answers</button>
        </div>
    );
}

const TrueFalseDisplay: React.FC<{questions: TrueFalseQuestion[]}> = ({ questions }) => {
    const [answers, setAnswers] = useState<{[key: number]: boolean}>({});
    const [submitted, setSubmitted] = useState(false);

    const getResultText = (qIndex: number) => {
        if (!submitted) return null;
        const correct = questions[qIndex].answer === answers[qIndex];
        return <span className={`font-bold ml-4 ${correct ? 'text-green-600' : 'text-red-600'}`}>{correct ? 'Correct' : 'Incorrect'}</span>;
    }
    
    return (
        <div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">True or False</h3>
            {questions.map((q, i) => (
                <div key={i} className="mb-4">
                    <p className="font-semibold mb-2">{i+1}. {q.statement}</p>
                    <div className="flex items-center gap-4">
                        <button disabled={submitted} onClick={() => setAnswers(p => ({...p, [i]: true}))} className={`px-4 py-1 border rounded ${answers[i] === true && !submitted ? 'bg-blue-500 text-white' : 'bg-white'}`}>True</button>
                        <button disabled={submitted} onClick={() => setAnswers(p => ({...p, [i]: false}))} className={`px-4 py-1 border rounded ${answers[i] === false && !submitted ? 'bg-blue-500 text-white' : 'bg-white'}`}>False</button>
                        {getResultText(i)}
                    </div>
                </div>
            ))}
            <button onClick={() => setSubmitted(true)} disabled={submitted} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400">Check Answers</button>
        </div>
    );
}

export const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const processText = (text: string) => {
    // Regex for **bold** and *italic*
    // Split by bold markers first
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    return parts.map((part, index) => {
      // Handle Bold
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-bold text-indigo-900 bg-indigo-50 px-1 rounded-sm border-b-2 border-indigo-100">
            {part.substring(2, part.length - 2)}
          </strong>
        );
      }
      
      // Handle Italic inside non-bold parts
      const italicParts = part.split(/(\*.*?\*)/g);
      return italicParts.map((subPart, subIndex) => {
          if (subPart.startsWith('*') && subPart.endsWith('*') && subPart.length > 2) {
              return <em key={`${index}-${subIndex}`} className="text-indigo-600 font-medium not-italic">{subPart.substring(1, subPart.length - 1)}</em>;
          }
          return subPart;
      });
    });
  };

  const blocks = content.split(/\n\s*\n/);

  return (
    <div className="space-y-4">
      {blocks.map((block, blockIndex) => {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) return null;

        // Headers
        if (trimmedBlock.startsWith('### ')) {
            return <h3 key={blockIndex} className="text-xl font-bold text-gray-800 mt-6 mb-2">{processText(trimmedBlock.replace(/^###\s+/, ''))}</h3>;
        }
        if (trimmedBlock.startsWith('## ')) {
            return <h2 key={blockIndex} className="text-2xl font-bold text-indigo-700 mt-8 mb-4 border-b border-indigo-100 pb-2">{processText(trimmedBlock.replace(/^##\s+/, ''))}</h2>;
        }
        if (trimmedBlock.startsWith('# ')) {
            return <h1 key={blockIndex} className="text-3xl font-extrabold text-gray-900 mt-8 mb-6">{processText(trimmedBlock.replace(/^#\s+/, ''))}</h1>;
        }

        // Blockquotes (Highlights)
        if (trimmedBlock.startsWith('> ')) {
            const lines = trimmedBlock.split('\n').map(l => l.replace(/^>\s*/, ''));
            return (
                <div key={blockIndex} className="bg-blue-50 border-l-4 border-blue-500 p-5 rounded-r-lg my-6 shadow-sm">
                    {lines.map((line, i) => (
                        <p key={i} className="text-blue-900 font-medium leading-relaxed mb-1 last:mb-0">
                            {processText(line)}
                        </p>
                    ))}
                </div>
            );
        }

        // Lists
        const lines = trimmedBlock.split('\n');
        if (lines.length > 0 && lines.every(line => line.trim().startsWith('- ') || line.trim().startsWith('* '))) {
          return (
            <ul key={blockIndex} className="list-outside ml-6 space-y-2 text-gray-700 marker:text-indigo-500 marker:text-xl">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex} className="pl-2 leading-relaxed">
                    {processText(line.replace(/^[-*]\s+/, ''))}
                </li>
              ))}
            </ul>
          );
        }

        // Paragraphs
        return (
            <p key={blockIndex} className="text-gray-700 leading-relaxed text-lg">
              {processText(trimmedBlock)}
            </p>
        );
      })}
    </div>
  );
};

const getDifficultyColor = (difficulty: Difficulty | undefined) => {
    switch (difficulty) {
        case 'Easy': return 'bg-green-500 text-white';
        case 'Medium': return 'bg-yellow-500 text-white';
        case 'Hard': return 'bg-red-500 text-white';
        default: return 'bg-gray-400 text-white';
    }
};

export const PastPaperDisplay: React.FC<{questions: PastPaperQuestion[], showTitle?: boolean}> = ({ questions, showTitle = true }) => (
    <div>
        {showTitle && <h3 className="text-xl font-bold text-gray-800 mb-4">Past Paper Q&A</h3>}
        {questions.map((q, i) => (
            <details key={i} className="mb-4 bg-gray-50 p-3 rounded-lg border">
                <summary className="font-semibold cursor-pointer flex justify-between items-center w-full">
                    <span className="pr-4">{q.question}</span>
                    {q.difficulty && (
                        <span className={`px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap ${getDifficultyColor(q.difficulty)}`}>
                            {q.difficulty}
                        </span>
                    )}
                </summary>
                
                <div className="mt-3 pt-3 border-t text-gray-700">
                    {q.imageUrl && (
                        <div className="mb-4 rounded-lg overflow-hidden border border-gray-200">
                            <img src={q.imageUrl} alt="Question Diagram" className="w-full h-auto object-contain max-h-96 bg-white" />
                        </div>
                    )}
                    <p className="font-bold">Model Answer:</p>
                    <MarkdownRenderer content={q.answer} />
                    {q.sourceUrl && (
                        <div className="mt-2 text-right">
                            <a 
                                href={q.sourceUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-xs text-blue-500 hover:text-blue-700 hover:underline flex items-center justify-end gap-1"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                Source found via Google Search
                            </a>
                        </div>
                    )}
                </div>
            </details>
        ))}
    </div>
);

// New Interactive Component for Grading
const SinglePastPaperQuestion: React.FC<{ q: PastPaperQuestion, index: number }> = ({ q, index }) => {
    const [userAnswer, setUserAnswer] = useState('');
    const [isGrading, setIsGrading] = useState(false);
    const [gradingResult, setGradingResult] = useState<PastPaperGradingResult | null>(null);
    const [showModelAnswer, setShowModelAnswer] = useState(false);
    const [imageError, setImageError] = useState(false);

    const handleGrade = async () => {
        if (!userAnswer.trim()) return;
        setIsGrading(true);
        try {
            const result = await gradePastPaperAnswer(q.question, q.answer, userAnswer);
            setGradingResult(result);
            setShowModelAnswer(true);
        } catch (error) {
            console.error(error);
        } finally {
            setIsGrading(false);
        }
    };

    return (
        <div className="mb-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
             <div className="flex justify-between items-start mb-4">
                <h4 className="font-bold text-lg text-gray-800 flex-1">
                    <span className="text-blue-600 mr-2">Q{index + 1}.</span> 
                    {q.question}
                </h4>
                {q.difficulty && (
                    <span className={`ml-3 px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap ${getDifficultyColor(q.difficulty)}`}>
                        {q.difficulty}
                    </span>
                )}
            </div>

            {q.imageUrl && !imageError && (
                <div className="mb-6 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                    <img 
                        src={q.imageUrl} 
                        alt="Question Diagram" 
                        className="w-full h-auto object-contain max-h-96 bg-white" 
                        onError={() => setImageError(true)}
                    />
                </div>
            )}
            {q.imageUrl && imageError && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                    <p className="text-sm text-yellow-800 mb-2">⚠️ Unable to load image preview.</p>
                    <a 
                        href={q.imageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-blue-600 hover:underline"
                    >
                        Click here to view image source
                    </a>
                </div>
            )}

            {/* Answer Input */}
            {!gradingResult ? (
                <div className="mt-4">
                    <textarea 
                        className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[120px] bg-white text-gray-900"
                        placeholder="Type your answer here to grade it..."
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                    />
                    <div className="flex justify-between items-center mt-3">
                         <button 
                            onClick={() => setShowModelAnswer(!showModelAnswer)} 
                            className="text-sm text-gray-500 hover:text-blue-600 underline"
                        >
                            {showModelAnswer ? "Hide Model Answer" : "Reveal Answer Only"}
                        </button>
                        <button 
                            onClick={handleGrade}
                            disabled={isGrading || !userAnswer.trim()}
                            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center"
                        >
                            {isGrading ? <><LoadingSpinner /><span className="ml-2">Grading...</span></> : 'Grade My Answer'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="mt-4 animate-fade-in-up">
                    <div className="p-4 bg-white rounded-lg border border-gray-200 mb-4">
                         <p className="text-xs font-bold text-gray-500 uppercase">Your Answer</p>
                         <p className="text-gray-800 italic">{userAnswer}</p>
                    </div>

                    <div className={`p-4 rounded-lg border-l-4 ${gradingResult.score >= gradingResult.maxScore / 2 ? 'bg-green-50 border-green-500' : 'bg-orange-50 border-orange-500'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <h5 className="font-bold text-lg">Examiner Feedback</h5>
                            <span className="text-xl font-extrabold">{gradingResult.score}/{gradingResult.maxScore} Marks</span>
                        </div>
                        <p className="text-gray-800">{gradingResult.feedback}</p>
                    </div>
                    <button 
                         onClick={() => { setGradingResult(null); setShowModelAnswer(false); }}
                         className="mt-3 text-sm text-blue-600 hover:underline"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {/* Model Answer Display */}
            {showModelAnswer && (
                <div className="mt-6 pt-6 border-t border-gray-200 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-2">
                         <p className="font-bold text-gray-700">Official Model Answer:</p>
                         {q.sourceUrl && (
                            <a 
                                href={q.sourceUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-xs text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-1"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                Source
                            </a>
                        )}
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-gray-800">
                        <MarkdownRenderer content={q.answer} />
                    </div>
                </div>
            )}
        </div>
    );
};

export const InteractivePastPaperDisplay: React.FC<{questions: PastPaperQuestion[]}> = ({ questions }) => (
    <div>
        <h3 className="text-xl font-bold text-gray-800 mb-6">Interactive Past Paper Questions</h3>
        {questions.map((q, i) => (
            <SinglePastPaperQuestion key={i} q={q} index={i} />
        ))}
    </div>
);


export default ResultsDisplay;
