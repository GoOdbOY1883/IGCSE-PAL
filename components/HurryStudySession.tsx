
import React, { useState, useEffect } from 'react';
import { extractTopicsFromNotes, explainTopicSimple, generateTheoryQuestions, gradeTheoryQuestions, generateDrillQuestions } from '../services/geminiService';
import { HurryStudyTopic, TheoryQuestion, TheoryGradingResult, TrueFalseQuestion, McqQuestion } from '../types';
import { LoadingSpinner, ArrowLeftIcon } from './icons';
import { MarkdownRenderer } from './ResultsDisplay';

interface HurryStudySessionProps {
    notes: string;
    onBack: () => void;
}

type Stage = 'loading-topics' | 'topic-selection' | 'explaining' | 'theory-easy' | 'theory-hard' | 'grading-theory' | 'results-theory' | 'drill-tf' | 'drill-mcq' | 'results-drill';

const HurryStudySession: React.FC<HurryStudySessionProps> = ({ notes, onBack }) => {
    const [stage, setStage] = useState<Stage>('loading-topics');
    const [topics, setTopics] = useState<HurryStudyTopic[]>([]);
    const [selectedTopic, setSelectedTopic] = useState<string>('');
    const [explanation, setExplanation] = useState<string>('');
    
    // Theory State
    const [theoryEasy, setTheoryEasy] = useState<TheoryQuestion[]>([]);
    const [theoryHard, setTheoryHard] = useState<TheoryQuestion[]>([]);
    const [theoryAnswers, setTheoryAnswers] = useState<{[key: number]: string}>({});
    const [theoryResult, setTheoryResult] = useState<TheoryGradingResult | null>(null);

    // Drill State
    const [tfQuestions, setTfQuestions] = useState<TrueFalseQuestion[]>([]);
    const [mcqQuestions, setMcqQuestions] = useState<McqQuestion[]>([]);
    const [tfAnswers, setTfAnswers] = useState<{[key: number]: boolean}>({});
    const [mcqAnswers, setMcqAnswers] = useState<{[key: number]: string}>({});

    const [isLoading, setIsLoading] = useState(false);

    // Initial Load: Extract Topics
    useEffect(() => {
        const loadTopics = async () => {
            setIsLoading(true);
            try {
                const result = await extractTopicsFromNotes(notes);
                setTopics(result);
                setStage('topic-selection');
            } catch (e) {
                console.error(e);
                setTopics([{ id: 'default', name: 'General Content' }]);
                setStage('topic-selection');
            } finally {
                setIsLoading(false);
            }
        };
        loadTopics();
    }, [notes]);

    const handleTopicSelect = async (topicName: string) => {
        setSelectedTopic(topicName);
        setStage('explaining');
        setIsLoading(true);
        try {
            const exp = await explainTopicSimple(notes, topicName);
            setExplanation(exp);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const startTheory = async () => {
        setIsLoading(true);
        try {
            const { easy, hard } = await generateTheoryQuestions(notes, selectedTopic);
            setTheoryEasy(easy);
            setTheoryHard(hard);
            setTheoryAnswers({});
            setStage('theory-easy');
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const submitTheory = async () => {
        setStage('grading-theory');
        setIsLoading(true);
        try {
            const allQuestions = [...theoryEasy, ...theoryHard];
            const result = await gradeTheoryQuestions(notes, selectedTopic, allQuestions, theoryAnswers);
            setTheoryResult(result);
            setStage('results-theory');
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const startDrill = async () => {
        setIsLoading(true);
        try {
            const { tf, mcq } = await generateDrillQuestions(notes, selectedTopic);
            setTfQuestions(tf);
            setMcqQuestions(mcq);
            setTfAnswers({});
            setMcqAnswers({});
            setStage('drill-tf');
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const calculateDrillScore = () => {
        let score = 0;
        let total = tfQuestions.length + mcqQuestions.length;
        
        tfQuestions.forEach((q, i) => {
            if (tfAnswers[i] === q.answer) score++;
        });
        mcqQuestions.forEach((q, i) => {
            if (mcqAnswers[i] === q.answer) score++;
        });
        
        return { score, total };
    };

    // --- Steps for Progress Bar ---
    const steps = ['Topics', 'Learn', 'Easy Qs', 'Hard Qs', 'Results', 'Drill'];
    const getStepIndex = () => {
        switch(stage) {
            case 'loading-topics':
            case 'topic-selection': return 0;
            case 'explaining': return 1;
            case 'theory-easy': return 2;
            case 'theory-hard': return 3;
            case 'grading-theory':
            case 'results-theory': return 4;
            case 'drill-tf':
            case 'drill-mcq':
            case 'results-drill': return 5;
            default: return 0;
        }
    };
    const currentStep = getStepIndex();

    const ProgressBar = () => (
        <div className="w-full mb-8 px-4">
            <div className="flex justify-between items-center relative z-10">
                {steps.map((label, idx) => {
                    const isCompleted = idx < currentStep;
                    const isActive = idx === currentStep;
                    return (
                        <div key={idx} className="flex flex-col items-center flex-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-all duration-300 border-2
                                ${isActive ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg scale-110' : 
                                  isCompleted ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-gray-400'}`}>
                                {isCompleted ? '✓' : idx + 1}
                            </div>
                            <span className={`hidden sm:block text-xs font-bold uppercase tracking-wide ${isActive ? 'text-indigo-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                                {label}
                            </span>
                        </div>
                    );
                })}
                {/* Connecting Line */}
                <div className="absolute top-4 left-0 w-full h-0.5 bg-gray-200 -z-10 transform -translate-y-1/2"></div>
                <div 
                    className="absolute top-4 left-0 h-0.5 bg-green-500 -z-10 transform -translate-y-1/2 transition-all duration-500" 
                    style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                ></div>
            </div>
        </div>
    );

    // --- Renderers ---

    if (stage === 'loading-topics') {
        return <div className="flex flex-col items-center justify-center h-96"><LoadingSpinner /><p className="mt-4 text-gray-600 font-medium animate-pulse">Analyzing notes for topics...</p></div>;
    }

    if (stage === 'topic-selection') {
        return (
            <div className="animate-fade-in-up container mx-auto px-4 max-w-5xl">
                <button onClick={onBack} className="mb-6 text-gray-500 hover:text-indigo-600 font-semibold flex items-center gap-2 transition-colors">
                    <ArrowLeftIcon /> Back to Workspace
                </button>
                <ProgressBar />
                <h2 className="text-3xl font-extrabold mb-8 text-center text-gray-800">Choose a Topic to Master</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {topics.map(t => (
                        <button 
                            key={t.id} 
                            onClick={() => handleTopicSelect(t.name)}
                            className="group p-8 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-xl hover:border-indigo-400 hover:-translate-y-1 transition-all duration-300 text-left"
                        >
                            <h3 className="text-xl font-bold text-gray-800 group-hover:text-indigo-600 mb-2">{t.name}</h3>
                            <p className="text-sm text-gray-500">Click to start studying</p>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (stage === 'explaining') {
        return (
            <div className="animate-fade-in-up max-w-4xl mx-auto px-4">
                 <button onClick={() => setStage('topic-selection')} className="mb-4 text-gray-500 hover:text-indigo-600 flex items-center gap-2 transition-colors"><ArrowLeftIcon /> Change Topic</button>
                 <ProgressBar />
                 <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-xl border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                    <h2 className="text-4xl font-extrabold mb-8 text-gray-900">{selectedTopic}</h2>
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <LoadingSpinner />
                            <p className="mt-4 text-indigo-600 font-medium">Generating simplified explanation...</p>
                        </div>
                    ) : (
                        <div className="prose prose-lg prose-indigo max-w-none text-gray-700 leading-relaxed">
                            <MarkdownRenderer content={explanation} />
                        </div>
                    )}
                    {!isLoading && (
                        <div className="mt-10 flex justify-end pt-6 border-t border-gray-100">
                            <button 
                                onClick={startTheory}
                                className="px-8 py-4 bg-indigo-600 text-white text-lg font-bold rounded-xl hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-0.5 transition-all"
                            >
                                Start Assessment →
                            </button>
                        </div>
                    )}
                 </div>
            </div>
        );
    }

    const renderTheoryInput = (questions: TheoryQuestion[], title: string, subtitle: string, nextAction: () => void, isHard: boolean) => (
        <div className="animate-fade-in-up max-w-3xl mx-auto px-4 pb-20">
            <ProgressBar />
            <div className={`text-center mb-8 p-6 rounded-2xl ${isHard ? 'bg-orange-50 text-orange-900' : 'bg-blue-50 text-blue-900'}`}>
                <h2 className="text-3xl font-extrabold mb-2">{title}</h2>
                <p className="text-lg opacity-90">{subtitle}</p>
            </div>
            
            <div className="space-y-8">
                {questions.map((q, idx) => (
                    <div key={q.id} className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex gap-4 mb-4">
                            <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${isHard ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                {idx + 1}
                            </span>
                            <p className="font-bold text-lg text-gray-800 leading-snug pt-1">{q.question}</p>
                        </div>
                        <div className="relative">
                            <textarea 
                                className="w-full p-4 text-gray-900 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-y text-base shadow-inner"
                                rows={isHard ? 6 : 4}
                                placeholder="Type your answer here..."
                                value={theoryAnswers[q.id] || ''}
                                onChange={(e) => setTheoryAnswers(prev => ({...prev, [q.id]: e.target.value}))}
                            />
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-10 flex justify-center">
                <button 
                    onClick={nextAction}
                    disabled={Object.keys(theoryAnswers).filter(k => questions.some(q => q.id === parseInt(k))).length < questions.length}
                    className={`px-10 py-4 text-lg font-bold rounded-xl shadow-lg transform transition-all 
                        ${Object.keys(theoryAnswers).filter(k => questions.some(q => q.id === parseInt(k))).length < questions.length
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : isHard 
                                ? 'bg-orange-600 hover:bg-orange-700 text-white hover:-translate-y-1 hover:shadow-orange-500/30' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white hover:-translate-y-1 hover:shadow-blue-500/30'}`}
                >
                    {isHard ? "Submit for Grading" : "Next Section →"}
                </button>
            </div>
        </div>
    );

    if (stage === 'theory-easy') return renderTheoryInput(theoryEasy, "Phase 1: Easy Questions", "Warm up with 2-3 line answers.", () => setStage('theory-hard'), false);
    if (stage === 'theory-hard') return renderTheoryInput(theoryHard, "Phase 2: Hard Questions", "Challenge yourself with 3-6 line detailed answers.", submitTheory, true);

    if (stage === 'grading-theory') return <div className="flex flex-col items-center justify-center h-96"><LoadingSpinner /><p className="mt-6 text-xl text-gray-700 font-semibold animate-pulse">Grading your answers against Cambridge standards...</p></div>;

    if (stage === 'results-theory' && theoryResult) {
        return (
            <div className="animate-fade-in-up max-w-4xl mx-auto px-4 pb-20">
                <ProgressBar />
                
                {/* Header Score Card */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl shadow-2xl p-8 mb-10 text-white text-center relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-3xl font-bold mb-2">Assessment Complete!</h2>
                        <div className="text-6xl font-extrabold my-4 tracking-tight">
                            {theoryResult.totalScore}<span className="text-3xl opacity-70">/{theoryResult.maxTotalScore}</span>
                        </div>
                        <p className="text-indigo-100 font-medium text-lg">See your detailed breakdown below.</p>
                    </div>
                    {/* Decorative circles */}
                    <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 right-0 translate-x-1/3 translate-y-1/3 w-80 h-80 bg-pink-500 opacity-20 rounded-full blur-3xl"></div>
                </div>

                {/* General Advice */}
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-r-xl shadow-sm mb-10">
                    <h3 className="flex items-center text-xl font-bold text-yellow-800 mb-3">
                        <span className="text-2xl mr-2">💡</span> Examiner's Advice
                    </h3>
                    <p className="text-gray-800 leading-relaxed text-lg">{theoryResult.generalAdvice}</p>
                </div>

                {/* Detailed Feedback */}
                <div className="space-y-8">
                    {theoryResult.feedbacks.map((f, i) => {
                        const isPerfect = f.score === f.maxScore;
                        const isGood = f.score > f.maxScore / 2;
                        const borderColor = isPerfect ? 'border-green-400' : isGood ? 'border-yellow-400' : 'border-red-400';
                        const badgeColor = isPerfect ? 'bg-green-100 text-green-800' : isGood ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';

                        return (
                            <div key={i} className={`bg-white rounded-2xl shadow-sm border-l-8 ${borderColor} p-6 sm:p-8 overflow-hidden`}>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-6 border-b border-gray-100">
                                    <h4 className="text-lg font-bold text-gray-700">Question {i+1}</h4>
                                    <span className={`mt-2 sm:mt-0 px-4 py-1.5 rounded-full font-bold text-sm ${badgeColor}`}>
                                        Score: {f.score} / {f.maxScore}
                                    </span>
                                </div>

                                <div className="grid gap-6">
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Your Answer</p>
                                        <div className="bg-gray-50 p-4 rounded-xl text-gray-800 italic border border-gray-200">
                                            "{theoryAnswers[f.questionId] || "No Answer"}"
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Feedback</p>
                                        <p className="text-gray-700 leading-relaxed">{f.feedback}</p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Model Answer</p>
                                        <div className="bg-green-50 p-4 rounded-xl text-green-900 border border-green-100 font-medium">
                                            {f.modelAnswer}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
                    <button 
                        onClick={() => setStage('topic-selection')} 
                        className="px-8 py-4 bg-white border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800 transition-all"
                    >
                        Change Topic
                    </button>
                    <button 
                        onClick={startDrill} 
                        className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-1 transition-all"
                    >
                        Start Rapid Fire Drill →
                    </button>
                </div>
            </div>
        );
    }

    if (stage === 'drill-tf') {
        return (
            <div className="animate-fade-in-up max-w-3xl mx-auto px-4 pb-20">
                <ProgressBar />
                <h2 className="text-3xl font-extrabold mb-8 text-center text-gray-800">True or False Drill</h2>
                {isLoading ? <div className="flex justify-center"><LoadingSpinner /></div> : (
                    <div className="space-y-4">
                        {tfQuestions.map((q, i) => (
                            <div key={i} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 hover:shadow-md transition-shadow">
                                <p className="font-semibold text-gray-800 text-lg">{i+1}. {q.statement}</p>
                                <div className="flex gap-3 flex-shrink-0">
                                    <button 
                                        onClick={() => setTfAnswers(p => ({...p, [i]: true}))} 
                                        className={`px-6 py-2 border-2 rounded-lg font-bold transition-all ${tfAnswers[i] === true ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'}`}
                                    >
                                        True
                                    </button>
                                    <button 
                                        onClick={() => setTfAnswers(p => ({...p, [i]: false}))} 
                                        className={`px-6 py-2 border-2 rounded-lg font-bold transition-all ${tfAnswers[i] === false ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'}`}
                                    >
                                        False
                                    </button>
                                </div>
                            </div>
                        ))}
                        <div className="flex justify-end mt-10">
                            <button 
                                onClick={() => setStage('drill-mcq')} 
                                className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md transition-all"
                            >
                                Next: MCQs →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (stage === 'drill-mcq') {
         return (
            <div className="animate-fade-in-up max-w-3xl mx-auto px-4 pb-20">
                <ProgressBar />
                <h2 className="text-3xl font-extrabold mb-8 text-center text-gray-800">MCQ Drill</h2>
                <div className="space-y-8">
                    {mcqQuestions.map((q, i) => (
                        <div key={i} className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm">
                            <p className="font-bold text-xl mb-6 text-gray-800">{i+1}. {q.question}</p>
                            <div className="grid gap-3">
                                {q.options.map((opt, optIdx) => (
                                    <button 
                                        key={optIdx} 
                                        onClick={() => setMcqAnswers(p => ({...p, [i]: opt}))}
                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all font-medium text-gray-700
                                            ${mcqAnswers[i] === opt 
                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-inner' 
                                                : 'bg-white border-gray-100 hover:border-indigo-200 hover:bg-gray-50'}`}
                                    >
                                        <span className="mr-3 font-bold text-gray-400">{String.fromCharCode(65 + optIdx)}.</span>
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-center mt-12">
                     <button 
                        onClick={() => setStage('results-drill')} 
                        className="px-10 py-4 bg-green-600 text-white text-lg font-bold rounded-xl shadow-lg hover:bg-green-700 hover:-translate-y-1 transition-all"
                     >
                        Submit Drill Answers
                     </button>
                </div>
            </div>
         );
    }

    if (stage === 'results-drill') {
        const { score, total } = calculateDrillScore();
        return (
            <div className="animate-fade-in-up max-w-5xl mx-auto px-4 pb-20">
                <ProgressBar />
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-extrabold text-gray-900 mb-4">Drill Results</h2>
                    <div className="inline-block px-10 py-4 bg-teal-50 border border-teal-200 text-teal-800 rounded-2xl text-3xl font-bold shadow-sm">
                        You Scored: <span className="text-teal-600">{score}</span> / {total}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-4">True/False Review</h3>
                        <div className="space-y-4">
                            {tfQuestions.map((q, i) => {
                                const correct = tfAnswers[i] === q.answer;
                                return (
                                    <div key={i} className={`p-4 rounded-xl border-l-4 ${correct ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'}`}>
                                        <p className="text-gray-800 font-medium mb-2">{q.statement}</p>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-bold text-gray-500">You: <span className={correct ? 'text-green-600' : 'text-red-600'}>{tfAnswers[i] ? 'True' : 'False'}</span></span>
                                            {!correct && <span className="font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">Ans: {q.answer ? 'True' : 'False'}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                         <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-4">MCQ Review</h3>
                         <div className="space-y-4">
                            {mcqQuestions.map((q, i) => {
                                const correct = mcqAnswers[i] === q.answer;
                                return (
                                    <div key={i} className={`p-4 rounded-xl border-l-4 ${correct ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'}`}>
                                        <p className="text-gray-800 font-medium mb-3">{q.question}</p>
                                        <div className="flex flex-col gap-1 text-sm">
                                             <div className="flex justify-between">
                                                 <span className="font-bold text-gray-500">You: <span className={correct ? 'text-green-600' : 'text-red-600'}>{mcqAnswers[i]}</span></span>
                                             </div>
                                             {!correct && (
                                                 <div className="mt-1 font-bold text-green-700 bg-green-100 p-2 rounded">
                                                     Correct: {q.answer}
                                                 </div>
                                             )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
                    <button onClick={() => setStage('topic-selection')} className="px-8 py-4 bg-white border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all">
                        Finish Session
                    </button>
                    <button onClick={startTheory} className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg transition-all">
                        Restart Topic Theory
                    </button>
                </div>
            </div>
        );
    }

    return null;
};

export default HurryStudySession;
