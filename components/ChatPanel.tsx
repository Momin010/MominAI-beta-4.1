
import React, { useState, useRef, useEffect } from 'react';
import type { Message, FileAttachment } from '../types';
import { Icon } from './Icon';
import { ValidationError, validateChatMessage, validateFileAttachment, decodeHtmlEntities } from '../utils/validation';

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (message: string, attachment?: FileAttachment | null) => void;
  aiStatus: string | null;
  streamingMessage?: string;
  isStreaming?: boolean;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, aiStatus, streamingMessage = '', isStreaming = false }) => {
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<FileAttachment | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = aiStatus !== null;

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, aiStatus]);

  const handleSend = () => {
    if (isLoading) return;
    
    try {
      const message = input.trim();
      
      // Validate input
      if (!message && !attachment) {
        return; // Nothing to send
      }
      
      if (message) {
        validateChatMessage(message);
      }
      
      onSendMessage(message, attachment);
      setInput('');
      setAttachment(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Message validation failed:', error);
      const errorMsg = error instanceof ValidationError ? error.message : 'Invalid message format';
      alert(`Error: ${errorMsg}`);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      // Validate file before processing
      validateFileAttachment(file);
      
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        try {
          const result = loadEvent.target?.result as string;
          if (!result) {
            throw new Error('Failed to read file content');
          }
          
          const base64String = result.split(',')[1];
          if (!base64String) {
            throw new Error('Invalid file format');
          }
          
          setAttachment({
            name: file.name,
            type: file.type,
            content: base64String,
          });
        } catch (error) {
          console.error('Error processing file:', error);
          alert('Error processing file. Please try again.');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };
      
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        alert('Error reading file. Please try again.');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File validation failed:', error);
      const errorMsg = error instanceof ValidationError ? error.message : 'Invalid file';
      alert(`File validation error: ${errorMsg}`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    // Prevent extremely long inputs
    if (value.length <= 10000) {
      setInput(value);
    }
  };

  const displayedMessages = messages.filter(m => m.role !== 'system');
  const reversedMessages = [...displayedMessages].reverse();

  // Typing animation state for streaming AI message
  const [typed, setTyped] = useState('');
  const [typingIndex, setTypingIndex] = useState(0);
  useEffect(() => {
    if (isStreaming && streamingMessage) {
      setTyped('');
      setTypingIndex(0);
    }
  }, [isStreaming, streamingMessage]);

  useEffect(() => {
    if (isStreaming && streamingMessage) {
      if (typingIndex < streamingMessage.length) {
        const timeout = setTimeout(() => {
          setTyped(streamingMessage.slice(0, typingIndex + 1));
          setTypingIndex(typingIndex + 1);
        }, 18); // Typing speed (ms per char)
        return () => clearTimeout(timeout);
      }
    }
  }, [isStreaming, streamingMessage, typingIndex]);

  return (
    <div className="flex flex-col h-full bg-black/20 backdrop-blur-lg md:border border-white/10 md:rounded-2xl overflow-hidden">
      <div ref={scrollContainerRef} className="flex-grow p-4 overflow-y-auto">
        <div className="flex flex-col-reverse gap-6">
          {aiStatus && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full border border-purple-400/50 flex items-center justify-center flex-shrink-0 bg-black/20 p-0.5 relative">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 opacity-50" />
                <div className="absolute inset-0 rounded-full border border-purple-400 animate-pulse"></div>
              </div>
              <div className="max-w-md p-3 rounded-xl bg-black/30 text-gray-200 rounded-bl-none">
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-gray-300">{aiStatus}</p>
                  <div className="dot-pulse flex space-x-1">
                    <span className="w-1.5 h-1.5 bg-purple-300 rounded-full"></span>
                    <span className="w-1.5 h-1.5 bg-purple-300 rounded-full"></span>
                    <span className="w-1.5 h-1.5 bg-purple-300 rounded-full"></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {reversedMessages.map((msg, revIndex) => {
            const originalIndex = displayedMessages.length - 1 - revIndex;
            // If this is the latest model message and streaming, show typing animation
            const isLatestModel =
              revIndex === 0 &&
              msg.role === 'model' &&
              isStreaming;
            return (
              <div key={originalIndex} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'model' && 
                  <div className="w-8 h-8 rounded-full border border-purple-400/50 flex items-center justify-center flex-shrink-0 bg-black/20 p-0.5">
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 opacity-50" />
                  </div>
                }
                <div className={`max-w-md p-4 rounded-2xl ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-none' : 'bg-black/30 text-gray-200 rounded-bl-none'}`}>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {isLatestModel
                      ? <span>{typed}<span className="animate-blink">|</span></span>
                      : decodeHtmlEntities(msg.content)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="p-4 border-t border-white/10">
        {attachment && (
           <div className="pb-2">
            <div className="relative inline-block bg-black/30 rounded-lg p-1.5">
                <img 
                    src={`data:${attachment.type};base64,${attachment.content}`} 
                    alt={attachment.name} 
                    className="h-16 w-auto rounded" 
                />
                <button 
                    onClick={() => {
                        setAttachment(null);
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                        }
                    }} 
                    className="absolute -top-2 -right-2 bg-gray-800 border border-white/10 rounded-full p-0.5 text-white hover:bg-red-500 transition-colors"
                    aria-label="Remove attachment"
                >
                    <Icon name="close" className="w-4 h-4" />
                </button>
            </div>
        </div>
        )}
        <div className="relative">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Describe your web app or attach an image reference..."
            className="w-full bg-black/40 rounded-xl p-3 pr-24 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 transition-shadow"
            rows={1}
            disabled={isLoading}
            maxLength={10000}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10" aria-label="Attach file" disabled={isLoading}><Icon name="paperclip" className="w-5 h-5"/></button>
            <button onClick={handleSend} disabled={isLoading || (!input.trim() && !attachment)} className="p-2 rounded-lg text-white bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors" aria-label="Send message">
              <Icon name="send" className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
