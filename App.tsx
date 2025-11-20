
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Image as ImageIcon, Camera, X, Trash2, Sparkles, Loader2, GraduationCap, Mic, MicOff, Calculator, FileText, FileCode, Lightbulb, WifiOff, Paperclip, ScanLine, Search, Upload, Wand2, Minimize2, Maximize2, Edit3, FileOutput } from 'lucide-react';
import { Message, Attachment } from './types';
import { streamGeminiResponse } from './services/geminiService';
import MessageBubble from './components/MessageBubble';
import CameraCapture from './components/CameraCapture';
import { processFile } from './utils/fileHelpers';
import { compressImage } from './utils/imageUtils';
import { saveHistory, getHistory } from './utils/db';

// Custom hook for online status
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const isOnline = useOnlineStatus();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const loadData = async () => {
      const history = await getHistory();
      if (history.length > 0) {
        setMessages(history);
      } else {
        setMessages([{
          id: '1',
          role: 'model',
          text: "Hello! I'm Haruna AI, your multimodal AI tutor. I can help you learn, repair documents, analyze designs, and solve problems. Upload a file or ask a question to start!",
          timestamp: Date.now(),
        }]);
      }
      setIsHistoryLoaded(true);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isHistoryLoaded && !searchQuery) {
      scrollToBottom();
    }
  }, [messages, isLoading, isHistoryLoaded, searchQuery]);

  useEffect(() => {
    if (isHistoryLoaded) {
      saveHistory(messages);
    }
  }, [messages, isHistoryLoaded]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => {
        const newText = prev.trim() ? `${prev} ${transcript}` : transcript;
        return newText;
      });
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening]);

  const handleFeedback = useCallback((id: string, type: 'up' | 'down') => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === id) {
        return {
          ...msg,
          feedback: msg.feedback === type ? undefined : type
        };
      }
      return msg;
    }));
  }, []);

  const handleSend = useCallback(async (manualText?: string) => {
    const textToSend = typeof manualText === 'string' ? manualText : input;
    
    if ((!textToSend.trim() && !selectedAttachment) || isLoading || isProcessingFile) return;

    if (!isOnline) {
        alert("You are currently offline. Please connect to the internet to ask new questions.");
        return;
    }

    // Reset search when sending a message
    if (searchQuery) {
      setSearchQuery('');
      setIsSearchOpen(false);
    }

    // Default prompts based on attachment type
    let defaultPrompt = "";
    if (selectedAttachment) {
        if (selectedAttachment.type === 'image') defaultPrompt = "Analyze this image.";
        if (selectedAttachment.type === 'pdf') defaultPrompt = "Summarize this document.";
        if (selectedAttachment.type === 'text') defaultPrompt = "Proofread and repair this document.";
    }

    const messageText = textToSend.trim() || defaultPrompt;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: messageText,
      attachment: selectedAttachment || undefined,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSelectedAttachment(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsLoading(true);

    const currentHistory = messages;

    try {
      const botMessageId = (Date.now() + 1).toString();
      setMessages(prev => [
        ...prev, 
        { id: botMessageId, role: 'model', text: '', timestamp: Date.now() }
      ]);

      const generator = streamGeminiResponse(
        currentHistory,
        userMessage.text,
        userMessage.attachment || null
      );
      
      let fullText = '';

      for await (const chunk of generator) {
        fullText += chunk;
        setMessages(prev => 
          prev.map(msg => 
            msg.id === botMessageId ? { ...msg, text: fullText } : msg
          )
        );
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [
        ...prev, 
        { 
          id: Date.now().toString(), 
          role: 'model', 
          text: "I'm sorry, I encountered an error while processing that. Please check your connection and try again.", 
          isError: true, 
          timestamp: Date.now() 
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, selectedAttachment, isLoading, messages, isOnline, searchQuery, isProcessingFile]);

  const processSelectedFile = async (file: File) => {
    setIsProcessingFile(true);
    try {
      // Use new processFile helper for all file types
      const attachment = await processFile(file);
      
      // If it's an image, still perform compression for UI performance/API limits
      if (attachment.type === 'image' && attachment.data) {
           attachment.data = await compressImage(attachment.data);
      }
      
      setSelectedAttachment(attachment);
    } catch (error) {
      console.error("File upload failed", error);
      alert("Failed to process file. Please ensure it is a valid Image, PDF, or DOCX.");
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        await processSelectedFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCameraCapture = (base64: string) => {
      setSelectedAttachment({
          type: 'image',
          mimeType: 'image/jpeg',
          data: base64,
          name: `Capture_${Date.now()}.jpg`
      });
  };

  const clearChat = async () => {
    const newHistory: Message[] = [{
      id: Date.now().toString(),
      role: 'model',
      text: "Chat cleared. Upload a document or ask a question to continue.",
      timestamp: Date.now(),
    }];
    setMessages(newHistory);
    setSearchQuery('');
    setIsSearchOpen(false);
    await saveHistory(newHistory);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Updates input field for manual typing suggestions
  const handleSuggestionClick = (prompt: string) => {
    setInput(prompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Immediately sends the prompt for quick actions
  const handleQuickAction = (prompt: string) => {
    handleSend(prompt);
  };

  // Drag and Drop Handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOnline) {
        setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (!isOnline) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processSelectedFile(files[0]);
    }
  };

  const getFilePreviewStyles = (name: string, type: string) => {
      const ext = name.split('.').pop()?.toLowerCase();
      if (type === 'pdf' || ext === 'pdf') {
          return { icon: <FileText size={20} />, color: 'text-rose-400', bg: 'bg-rose-500/20', label: 'PDF' };
      }
      if (ext === 'docx' || ext === 'doc') {
          return { icon: <FileText size={20} />, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'DOCX' };
      }
      if (['txt', 'md', 'json', 'csv', 'js', 'ts', 'py'].includes(ext || '')) {
          return { icon: <FileCode size={20} />, color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'TXT' };
      }
      return { icon: <FileText size={20} />, color: 'text-indigo-400', bg: 'bg-indigo-500/20', label: 'FILE' };
  };

  const displayedMessages = searchQuery.trim() 
    ? messages.filter(msg => 
        msg.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
        msg.attachment?.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  if (!isHistoryLoaded) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-950">
            <Loader2 className="text-indigo-500 animate-spin" size={48} />
        </div>
      )
  }

  return (
    <div 
        className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans relative"
        onDragEnter={handleDragEnter}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div 
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center border-4 border-indigo-500 border-dashed m-4 rounded-3xl animate-in fade-in duration-200"
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <div className="flex flex-col items-center text-indigo-400 pointer-events-none">
                <Upload size={64} className="mb-4 animate-bounce" />
                <p className="text-2xl font-bold">Drop file to upload</p>
                <p className="text-slate-400 mt-2">Images, PDF, or DOCX</p>
            </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 z-10 sticky top-0">
        {isSearchOpen ? (
             <div className="flex-1 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search history..."
                        className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:border-indigo-500/50 transition-all"
                        autoFocus
                    />
                </div>
                <button 
                    onClick={() => {
                        setSearchQuery('');
                        setIsSearchOpen(false);
                    }}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                >
                    <X size={20} />
                </button>
             </div>
        ) : (
            <>
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg">
                    <GraduationCap size={24} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                      Haruna AI
                    </h1>
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-400">Multimodal Document Assistant</p>
                        {!isOnline && (
                            <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
                                <WifiOff size={10} /> Offline Mode
                            </span>
                        )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => setIsSearchOpen(true)}
                        className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                        title="Search History"
                    >
                        <Search size={20} />
                    </button>
                    <button 
                      onClick={clearChat}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                      title="Clear History"
                    >
                      <Trash2 size={20} />
                    </button>
                </div>
            </>
        )}
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
        <div className="max-w-3xl mx-auto space-y-6">
          {displayedMessages.map((msg) => (
            <MessageBubble 
                key={msg.id} 
                message={msg} 
                onFeedback={handleFeedback}
            />
          ))}

          {displayedMessages.length === 0 && searchQuery && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Search size={48} className="mb-4 opacity-20" />
                <p>No messages found matching "{searchQuery}"</p>
            </div>
          )}
          
          {messages.length === 1 && !searchQuery && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-2 md:px-4 mt-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                <button 
                    onClick={() => handleSuggestionClick("Please solve this math problem step-by-step.")}
                    className="flex items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 rounded-xl transition-all group text-left shadow-sm hover:shadow-md"
                >
                    <div className="bg-indigo-500/10 p-2.5 rounded-lg text-indigo-400 group-hover:text-indigo-300 group-hover:scale-110 transition-all duration-300">
                        <Calculator size={24} />
                    </div>
                    <div>
                        <p className="font-medium text-slate-200 text-sm">Solve Math</p>
                        <p className="text-xs text-slate-500">Step-by-step help</p>
                    </div>
                </button>

                <button 
                    onClick={() => handleSuggestionClick("Analyze the design of this document. What improvements do you suggest?")}
                    className="flex items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-xl transition-all group text-left shadow-sm hover:shadow-md"
                >
                    <div className="bg-emerald-500/10 p-2.5 rounded-lg text-emerald-400 group-hover:text-emerald-300 group-hover:scale-110 transition-all duration-300">
                        <ScanLine size={24} />
                    </div>
                    <div>
                        <p className="font-medium text-slate-200 text-sm">Design Analysis</p>
                        <p className="text-xs text-slate-500">Critique IDs or Layouts</p>
                    </div>
                </button>

                <button 
                    onClick={() => handleSuggestionClick("Please fix any grammar errors and improve the clarity of this document.")}
                    className="flex items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-xl transition-all group text-left shadow-sm hover:shadow-md"
                >
                    <div className="bg-amber-500/10 p-2.5 rounded-lg text-amber-400 group-hover:text-amber-300 group-hover:scale-110 transition-all duration-300">
                        <FileText size={24} />
                    </div>
                    <div>
                        <p className="font-medium text-slate-200 text-sm">Repair Document</p>
                        <p className="text-xs text-slate-500">Fix errors & grammar</p>
                    </div>
                </button>
                 
                 <button 
                    onClick={() => handleSuggestionClick("Create a study plan for learning about ")}
                    className="flex items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50 rounded-xl transition-all group text-left shadow-sm hover:shadow-md"
                >
                    <div className="bg-purple-500/10 p-2.5 rounded-lg text-purple-400 group-hover:text-purple-300 group-hover:scale-110 transition-all duration-300">
                        <Lightbulb size={24} />
                    </div>
                    <div>
                        <p className="font-medium text-slate-200 text-sm">Create Study Plan</p>
                        <p className="text-xs text-slate-500">Structured learning</p>
                    </div>
                </button>
            </div>
          )}

          {isLoading && messages[messages.length - 1]?.role === 'user' && !searchQuery && (
             <div className="flex justify-start w-full mb-6 animate-fade-in">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center animate-pulse-fast shadow-lg shadow-indigo-500/20">
                        <Sparkles size={16} className="text-white" />
                    </div>
                    <div className="bg-slate-800 px-5 py-4 rounded-2xl rounded-tl-sm border border-slate-700 shadow-sm">
                        <div className="flex gap-1.5">
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                    </div>
                </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <div className="p-4 bg-slate-900/90 border-t border-slate-800 z-20 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto">
          {/* Attachment Preview or Processing State */}
          {(selectedAttachment || isProcessingFile) && (
            <div className="flex flex-col items-start mb-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="relative group inline-block">
                {isProcessingFile ? (
                   <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl border border-indigo-500/50 shadow-lg pr-6">
                      <Loader2 size={20} className="animate-spin text-indigo-400" />
                      <p className="text-sm font-medium text-slate-300">Processing file...</p>
                   </div>
                ) : (
                  selectedAttachment && (
                      <>
                          {selectedAttachment.type === 'image' && selectedAttachment.data ? (
                              <div className="relative w-24 h-24">
                                  <img 
                                      src={selectedAttachment.data} 
                                      alt="Preview" 
                                      className="w-full h-full object-cover rounded-xl border-2 border-indigo-500/50 shadow-lg shadow-indigo-500/10" 
                                  />
                              </div>
                          ) : (
                              (() => {
                                const styles = getFilePreviewStyles(selectedAttachment.name, selectedAttachment.type);
                                return (
                                  <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl border border-indigo-500/50 shadow-lg shadow-indigo-500/10 pr-10">
                                      <div className={`${styles.bg} p-2 rounded-lg ${styles.color}`}>
                                          {styles.icon}
                                      </div>
                                      <div>
                                          <p className="text-sm font-medium text-white truncate max-w-[150px]">{selectedAttachment.name}</p>
                                          <p className="text-xs text-slate-400 uppercase">{styles.label}</p>
                                      </div>
                                  </div>
                                );
                              })()
                          )}
                          <button 
                              onClick={() => setSelectedAttachment(null)}
                              className="absolute -top-2 -right-2 bg-slate-800 text-red-400 rounded-full p-1.5 border border-slate-600 hover:bg-slate-700 transition-colors shadow-sm z-10"
                          >
                              <X size={14} />
                          </button>
                      </>
                  )
                )}
              </div>

              {/* Contextual File Actions */}
              {!isProcessingFile && selectedAttachment && (
                  <div className="mt-3 flex flex-wrap gap-2">
                      <button 
                          onClick={() => handleQuickAction("Summarize this document providing key takeaways and a brief overview.")}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-sky-500/20 text-slate-300 hover:text-sky-300 border border-slate-700 hover:border-sky-500/50 rounded-full transition-colors"
                      >
                          <FileText size={12} /> Summarize
                      </button>
                      <button 
                          onClick={() => handleQuickAction("Rephrase this document to be more professional and clear.")}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-300 border border-slate-700 hover:border-indigo-500/50 rounded-full transition-colors"
                      >
                          <Wand2 size={12} /> Rephrase
                      </button>
                      <button 
                          onClick={() => handleQuickAction("Expand on the key points of this document with more details.")}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-purple-500/20 text-slate-300 hover:text-purple-300 border border-slate-700 hover:border-purple-500/50 rounded-full transition-colors"
                      >
                          <Maximize2 size={12} /> Expand
                      </button>
                      <button 
                          onClick={() => handleQuickAction("Shorten this document and make it more concise.")}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/50 rounded-full transition-colors"
                      >
                          <Minimize2 size={12} /> Shorten
                      </button>
                      <button 
                          onClick={() => handleQuickAction("Proofread this document and fix any grammar or spelling errors.")}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-700 hover:border-amber-500/50 rounded-full transition-colors"
                      >
                          <Edit3 size={12} /> Fix Errors
                      </button>
                  </div>
              )}
            </div>
          )}

          <div className={`flex items-end gap-3 bg-slate-800/50 p-2 rounded-2xl border border-slate-700 transition-all shadow-inner ${!isOnline ? 'opacity-75' : 'focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50'}`}>
            {/* Tools */}
            <div className="flex items-center gap-1 pb-1.5 pl-1">
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-colors"
                    title="Upload Document (PDF, DOCX, Image)"
                    disabled={!isOnline || isProcessingFile}
                >
                    <Paperclip size={20} />
                </button>
                <button 
                    onClick={() => setIsCameraOpen(true)}
                    className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-colors"
                    title="Scan from Camera"
                    disabled={!isOnline || isProcessingFile}
                >
                    <Camera size={20} />
                </button>
                <button 
                    onClick={toggleListening}
                    disabled={!isOnline || isProcessingFile}
                    className={`p-2.5 rounded-xl transition-all ${
                        isListening 
                        ? 'text-red-400 bg-red-500/10 animate-pulse shadow-[0_0_10px_rgba(248,113,113,0.2)]' 
                        : 'text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10'
                    }`}
                    title={isListening ? "Stop Listening" : "Voice Input"}
                >
                    {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
            </div>

            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*,.pdf,.docx,.txt,.md,.json" 
                className="hidden" 
            />

            {/* Text Input */}
            <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={!isOnline ? "You are offline." : (isListening ? "Listening..." : (selectedAttachment ? "Ask about this file..." : "Ask a question or upload a document..."))}
                className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-base p-2.5 max-h-48 min-h-[48px] resize-none focus:outline-none disabled:text-slate-600"
                rows={1}
                disabled={!isOnline}
            />

            {/* Send Button */}
            <button 
                onClick={() => handleSend()}
                disabled={(!input.trim() && !selectedAttachment) || isLoading || !isOnline || isProcessingFile}
                className={`p-3 rounded-xl transition-all shadow-lg mb-0.5 ${
                   (!input.trim() && !selectedAttachment) || isLoading || !isOnline || isProcessingFile
                   ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                   : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20 hover:scale-105 active:scale-95'
                }`}
            >
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-500 mt-3 font-medium tracking-wide">
             MADE WITH ❤️ BY HARUNA +254725510204
          </p>
        </div>
      </div>

      {/* Camera Modal */}
      {isCameraOpen && (
        <CameraCapture 
          onCapture={handleCameraCapture} 
          onClose={() => setIsCameraOpen(false)} 
        />
      )}
    </div>
  );
}
