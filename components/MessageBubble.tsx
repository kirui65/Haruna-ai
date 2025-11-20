
import React, { useState } from 'react';
import { Message } from '../types';
import { Bot, User, ThumbsUp, ThumbsDown, FileText, FileCode, Download, Copy, Check, FileOutput } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { copyToClipboard, downloadAsDoc } from '../utils/fileHelpers';

interface MessageBubbleProps {
  message: Message;
  onFeedback?: (id: string, type: 'up' | 'down') => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onFeedback }) => {
  const isUser = message.role === 'user';
  const [isCopied, setIsCopied] = useState(false);

  const getFileStyles = (name: string, type: string) => {
      const ext = name.split('.').pop()?.toLowerCase();
      if (type === 'pdf' || ext === 'pdf') {
          return { icon: <FileText size={24} />, color: 'text-rose-400', bg: 'bg-rose-500/20', label: 'PDF Document' };
      }
      if (ext === 'docx' || ext === 'doc') {
          return { icon: <FileText size={24} />, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Word Document' };
      }
      if (['txt', 'md', 'json', 'csv', 'js', 'ts', 'py'].includes(ext || '')) {
          return { icon: <FileCode size={24} />, color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Text File' };
      }
      return { icon: <FileText size={24} />, color: 'text-indigo-400', bg: 'bg-indigo-500/20', label: 'File' };
  };

  const renderAttachment = () => {
    if (!message.attachment) return null;

    const { type, name, data } = message.attachment;

    if (type === 'image') {
      return (
        <div className="mb-3 rounded-lg overflow-hidden border border-white/20 shadow-md">
          <img src={data} alt="Uploaded content" className="max-w-full max-h-[300px] object-cover" />
        </div>
      );
    }

    const styles = getFileStyles(name, type);

    // PDF or Doc preview style
    return (
      <div className="mb-3 flex items-center gap-3 p-3 bg-slate-950/30 rounded-lg border border-white/10 max-w-xs">
        <div className={`${styles.bg} p-2 rounded-lg ${styles.color}`}>
          {styles.icon}
        </div>
        <div className="overflow-hidden">
          <p className="text-sm font-medium truncate text-slate-200">{name}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">{styles.label}</p>
        </div>
      </div>
    );
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([message.text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HarunaAI_Response_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportDoc = () => {
    downloadAsDoc(message.text, `HarunaAI_Export_${Date.now()}.doc`);
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(message.text);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className={`flex w-full mb-8 group ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center shadow-lg ${isUser ? 'bg-indigo-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
          {isUser ? <User size={20} className="text-white" /> : <Bot size={20} className="text-white" />}
        </div>

        {/* Bubble and Footer */}
        <div className={`flex flex-col w-full ${isUser ? 'items-end' : 'items-start'}`}>
          <div 
            className={`relative px-5 py-4 rounded-2xl shadow-lg text-sm md:text-base leading-relaxed overflow-hidden border
              ${isUser 
                ? 'bg-indigo-600 text-white rounded-tr-sm border-indigo-500' 
                : 'bg-slate-800 text-slate-200 rounded-tl-sm border-slate-700'
              }`}
          >
             {renderAttachment()}
            
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.text}</p>
            ) : (
               <div className="markdown-content">
                <ReactMarkdown
                    components={{
                        code({node, className, children, ...props}) {
                            return (
                                <code className={`${className} bg-black/30 rounded px-1.5 py-0.5 text-xs md:text-sm font-mono text-amber-200`} {...props}>
                                    {children}
                                </code>
                            )
                        },
                        pre({node, children, ...props}) {
                            return (
                                <pre className="bg-slate-950/50 p-4 rounded-xl overflow-x-auto my-3 text-xs md:text-sm font-mono border border-white/10 shadow-inner" {...props}>
                                    {children}
                                </pre>
                            )
                        },
                        ul({node, children, ...props}) {
                            return <ul className="list-disc list-inside my-2 space-y-1 marker:text-emerald-400" {...props}>{children}</ul>
                        },
                        ol({node, children, ...props}) {
                            return <ol className="list-decimal list-inside my-2 space-y-1 marker:text-emerald-400" {...props}>{children}</ol>
                        },
                        a({node, children, ...props}) {
                            return <a className="text-sky-400 hover:text-sky-300 hover:underline transition-colors" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
                        },
                        strong({node, children, ...props}) {
                            return <strong className="font-bold text-indigo-200" {...props}>{children}</strong>
                        },
                        blockquote({node, children, ...props}) {
                            return <blockquote className="border-l-4 border-indigo-500/50 pl-4 my-2 text-slate-400 italic" {...props}>{children}</blockquote>
                        }
                    }}
                >
                  {message.text}
                </ReactMarkdown>
              </div>
            )}
          </div>
          
          {/* Footer: Name and Enhanced Feedback */}
          <div className={`flex items-center justify-between w-full mt-2 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {isUser ? 'You' : 'Haruna AI'}
            </span>
            
            {!isUser && !message.isError && onFeedback && (
                <div className="flex items-center gap-3 animate-in fade-in duration-500">
                    
                    {/* Action Group */}
                    <div className="flex items-center gap-1 bg-slate-800/50 p-0.5 rounded-lg border border-slate-700/50">
                        <button 
                            onClick={handleCopy}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all relative group"
                            title="Copy to Clipboard"
                        >
                            {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                        <div className="w-px h-3 bg-slate-700"></div>
                        <button 
                            onClick={handleExportDoc}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-all"
                            title="Export to Word (Doc)"
                        >
                            <FileOutput size={14} />
                        </button>
                        <div className="w-px h-3 bg-slate-700"></div>
                        <button 
                            onClick={handleDownloadTxt}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all"
                            title="Download as Text"
                        >
                            <Download size={14} />
                        </button>
                    </div>

                    {/* Feedback Group */}
                    <div className="flex items-center gap-1 p-0.5 bg-slate-800/50 rounded-full border border-slate-700/50 shadow-sm">
                        <button 
                            onClick={() => onFeedback(message.id, 'up')}
                            className={`p-1.5 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center ${
                                message.feedback === 'up' 
                                ? 'text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/50 shadow-[0_0_10px_rgba(52,211,153,0.2)]' 
                                : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-700'
                            }`}
                            title="Helpful"
                        >
                            <ThumbsUp size={14} className={message.feedback === 'up' ? 'fill-current' : ''} strokeWidth={2.5} />
                        </button>
                        <div className="w-px h-4 bg-slate-700"></div>
                        <button 
                            onClick={() => onFeedback(message.id, 'down')}
                            className={`p-1.5 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center ${
                                message.feedback === 'down' 
                                ? 'text-rose-400 bg-rose-500/10 ring-1 ring-rose-500/50 shadow-[0_0_10px_rgba(251,113,133,0.2)]' 
                                : 'text-slate-400 hover:text-rose-400 hover:bg-slate-700'
                            }`}
                            title="Not Helpful"
                        >
                            <ThumbsDown size={14} className={message.feedback === 'down' ? 'fill-current' : ''} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
