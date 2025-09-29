
import React, { useState, useCallback, useEffect } from 'react';
import ChatPanel from './components/ChatPanel';
import Header from './components/Header';
import EditorPreviewPanel from './components/EditorPreviewPanel';
import PublishModal from './components/PublishModal';
import CommandPalette from './components/CommandPalette';
import LivePreview from './components/LivePreview';
import type { Message, Files, Change, FileAttachment, History, AppState } from './types';
import { resetChat } from './services/geminiService';
import { apiClient } from './client/services/api';
import { downloadProjectAsZip } from './services/zipService';
import { INITIAL_CHAT_MESSAGE, INITIAL_FILES } from './constants';
import usePersistentState from './hooks/usePersistentState';
import { ValidationError, validateProjectName, validateFileContent } from './utils/validation';

type MobileView = 'chat' | 'preview';


const INITIAL_APP_STATE: AppState = {
  files: INITIAL_FILES,
  previewHtml: '',
  chatMessages: [INITIAL_CHAT_MESSAGE],
  hasGeneratedCode: false,
  projectName: 'Untitled Project',
};

const INITIAL_HISTORY: History = {
  versions: [INITIAL_APP_STATE],
  currentIndex: 0,
};


const App: React.FC = () => {

  const [history, setHistory] = usePersistentState<History>('mominai_history', INITIAL_HISTORY);
  const [activeFile, setActiveFile] = usePersistentState<string>('mominai_activeFile', '');
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<MobileView>('chat');
  const [isPublishModalOpen, setPublishModalOpen] = useState(false);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);

  // Handles code changes in the editor
  const handleCodeChange = useCallback((newContent: string) => {
    if (!activeFile) return;
    try {
      validateFileContent(newContent);
      setHistory(prevHistory => {
        const newVersions = [...prevHistory.versions];
        const currentVersion = { ...newVersions[prevHistory.currentIndex] };
        currentVersion.files = { ...currentVersion.files, [activeFile]: newContent };
        newVersions[prevHistory.currentIndex] = currentVersion;
        return { ...prevHistory, versions: newVersions };
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        alert(`Code validation error: ${error.message}`);
      } else {
        alert('Error updating code. Please try again.');
      }
    }
  }, [activeFile, setHistory]);
 
  const currentState = history.versions[history.currentIndex];
  const { files, previewHtml, chatMessages, hasGeneratedCode, projectName } = currentState;
  
  const isProjectLoaded = Object.keys(files).length > 0;
  const canUndo = history.currentIndex > 0;
  const canRedo = history.currentIndex < history.versions.length - 1;

  useEffect(() => {
    resetChat();
  }, []);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPreviewFullscreen) {
        setIsPreviewFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewFullscreen]);

  useEffect(() => {
    if (activeFile && !files.hasOwnProperty(activeFile)) {
      setActiveFile(Object.keys(files)[0] || '');
    } else if (!activeFile && Object.keys(files).length > 0) {
      const preferredFiles = ['src/App.tsx', 'src/pages/Home.tsx', 'index.html', 'package.json'];
      const defaultFile = preferredFiles.find(f => f in files) || Object.keys(files)[0];
      setActiveFile(defaultFile);
    }
  }, [files, activeFile, setActiveFile]);

  const addHistoryState = useCallback((updater: (prevState: AppState) => AppState) => {
    setHistory(prevHistory => {
        const currentVersion = prevHistory.versions[prevHistory.currentIndex];
        const newVersion = updater(currentVersion);
        
        const newVersions = prevHistory.versions.slice(0, prevHistory.currentIndex + 1);
        newVersions.push(newVersion);

        return {
            versions: newVersions,
            currentIndex: newVersions.length - 1,
        };
    });
  }, [setHistory]);

  const handleSendMessage = useCallback(async (message: string, attachment?: FileAttachment) => {
    try {
      if (!message && !attachment) {
        console.warn('No message or attachment provided');
        return;
      }
      const userMessage: Message = { role: 'user', content: message || '' };
      const tempChatMessages = [...chatMessages, userMessage];
      setHistory(h => ({
        ...h,
        versions: h.versions.map((v, i) =>
          i === h.currentIndex ? { ...v, chatMessages: tempChatMessages } : v
        )
      }));
      setAiStatus('MominAI is thinking...');
      setStreamingMessage('');
      setIsStreaming(true);
      // Stream AI response
      const response = await apiClient.streamAI(tempChatMessages, { files: hasGeneratedCode ? files : null, attachment });
      const reader = response.body?.getReader();
      let aiMessage = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = new TextDecoder().decode(value);
          // Parse SSE lines
          const lines = chunk.split('\n').filter(line => line.trim());
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'chunk' && parsed.data) {
                  aiMessage += parsed.data;
                  setStreamingMessage(aiMessage);
                }
                if (parsed.type === 'complete' && parsed.data) {
                  aiMessage = parsed.data;
                  setStreamingMessage(aiMessage);
                }
                if (parsed.type === 'error') {
                  setAiStatus('Error: ' + parsed.data);
                  setIsStreaming(false);
                  return;
                }
              } catch {}
            }
          }
        }
      }
      setIsStreaming(false);
      setAiStatus(null);
      addHistoryState(prev => ({
        ...prev,
        chatMessages: [...prev.chatMessages, { role: 'model', content: aiMessage }]
      }));
    } catch (error) {
      setAiStatus('Error: ' + (error instanceof Error ? error.message : String(error)));
      setIsStreaming(false);
    }
  }, [chatMessages, hasGeneratedCode, files, addHistoryState, setHistory, apiClient]);



  const handleRenameProject = useCallback((newName: string) => {
    try {
      const validatedName = validateProjectName(newName);
      
      setHistory(prevHistory => {
        const newVersions = [...prevHistory.versions];
        const currentVersion = { ...newVersions[prevHistory.currentIndex] };
        currentVersion.projectName = validatedName;
        newVersions[prevHistory.currentIndex] = currentVersion;
        return { ...prevHistory, versions: newVersions };
      });
    } catch (error) {
      console.error('Error renaming project:', error);
      
      if (error instanceof ValidationError) {
        alert(`Project name validation error: ${error.message}`);
      } else {
        alert('Error renaming project. Please try again.');
      }
    }
  }, [setHistory]);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      setHistory(prevHistory => ({
        ...prevHistory,
        currentIndex: prevHistory.currentIndex - 1,
      }));
    }
  }, [canUndo, setHistory]);

  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistory(prevHistory => ({
        ...prevHistory,
        currentIndex: prevHistory.currentIndex + 1,
      }));
    }
  }, [canRedo, setHistory]);

  const handleDownload = useCallback(async () => {
    try {
      await downloadProjectAsZip(files, projectName);
    } catch (error) {
      console.error('Error downloading project:', error);
      alert('Error downloading project. Please try again.');
    }
  }, [files, projectName]);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <Header
        projectName={projectName}
        onRenameProject={handleRenameProject}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onDownload={handleDownload}
        onPublish={() => setPublishModalOpen(true)}
        canUndo={canUndo}
        canRedo={canRedo}
        isProjectLoaded={isProjectLoaded}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <div className={`${mobileView === 'chat' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-1/2 border-r border-gray-700`}>
          <ChatPanel
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            aiStatus={aiStatus}
          />
        </div>
        
        <div className={`${mobileView === 'preview' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-1/2`}>
          <EditorPreviewPanel
            files={files}
            activeFile={activeFile}
            onFileSelect={setActiveFile}
            onCodeChange={handleCodeChange}
            previewHtml={previewHtml}
            onToggleFullscreen={() => setIsPreviewFullscreen(!isPreviewFullscreen)}
            isFullscreen={isPreviewFullscreen}
          />
        </div>
      </div>
      
      <div className="md:hidden flex border-t border-gray-700">
        <button
          onClick={() => setMobileView('chat')}
          className={`flex-1 py-3 text-center ${
            mobileView === 'chat' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setMobileView('preview')}
          className={`flex-1 py-3 text-center ${
            mobileView === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'
          }`}
        >
          Preview
        </button>
      </div>
      
      {isPublishModalOpen && (
        <PublishModal
          files={files}
          projectName={projectName}
          onClose={() => setPublishModalOpen(false)}
        />
      )}
      
      {isCommandPaletteOpen && (
        <CommandPalette
          onClose={() => setCommandPaletteOpen(false)}
          onAction={(action) => {
            setCommandPaletteOpen(false);
          }}
        />
      )}
      
      {isPreviewFullscreen && (
        <LivePreview
          html={previewHtml}
          onClose={() => setIsPreviewFullscreen(false)}
        />
      )}
    </div>
  );
}
export default App;
