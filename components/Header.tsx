import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';

interface HeaderProps {
  projectName: string;
  onRenameProject: (name: string) => void;
  onDownloadProject: () => void;
  onPublish: () => void;
  mobileView: 'chat' | 'preview';
  isProjectLoaded: boolean;
  onToggleView: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  projectName, 
  onRenameProject,
  onDownloadProject,
  onPublish,
  mobileView, 
  isProjectLoaded, 
  onToggleView,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}) => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [isRenaming, setRenaming] = useState(false);
  const [tempName, setTempName] = useState(projectName);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTempName(projectName);
  }, [projectName]);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
        setRenaming(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      onRenameProject(tempName.trim());
    }
    setRenaming(false);
    setDropdownOpen(false);
  };
  
  const handleDownloadClick = () => {
    onDownloadProject();
    setDropdownOpen(false);
  };

  return (
    <header className="relative z-30 flex items-center justify-between py-2 px-4 bg-black/20 backdrop-blur-lg border-b border-white/10 flex-shrink-0">
      <div className="flex-1 flex items-center gap-4">
        <div className="relative" ref={dropdownRef}>
          {isRenaming ? (
            <form onSubmit={handleRenameSubmit}>
              <input
                ref={inputRef}
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleRenameSubmit}
                className="bg-white/20 text-white font-semibold rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </form>
          ) : (
            <button 
              onClick={() => setDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <span className="font-semibold">{projectName}</span>
              <Icon name="chevron-down" className="w-4 h-4" />
            </button>
          )}
          {isDropdownOpen && !isRenaming && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800 border border-white/10 rounded-xl shadow-lg z-20">
              <button
                onClick={() => setRenaming(true)}
                className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
              >
                Rename
              </button>
              <button
                onClick={handleDownloadClick}
                className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
              >
                Download ZIP
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 flex justify-center items-center gap-2">
         {isProjectLoaded && (
            <>
              <button 
                onClick={onUndo} 
                disabled={!canUndo} 
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:text-gray-600 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors" 
                aria-label="Undo"
              >
                <Icon name="undo" className="w-5 h-5" />
              </button>
              <button 
                onClick={onRedo} 
                disabled={!canRedo} 
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:text-gray-600 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors" 
                aria-label="Redo"
              >
                <Icon name="redo" className="w-5 h-5" />
              </button>
            </>
         )}
      </div>

      <div className="flex-1 flex justify-end items-center gap-4">
        {isProjectLoaded && (
           <div className="md:hidden">
            <button onClick={onToggleView} className="px-3 py-2 text-sm font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors flex items-center gap-2">
              {mobileView === 'chat' ? (
                <>
                  <Icon name="eye" className="w-4 h-4" />
                  <span>View</span>
                </>
              ) : (
                <>
                   <Icon name="chat" className="w-4 h-4" />
                  <span>Chat</span>
                </>
              )}
            </button>
          </div>
        )}
       
        <div className="hidden md:flex items-center gap-4">
          <a 
            href="https://github.com/Momin-Ai/Momin-AI-IDE" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors" 
            aria-label="View on GitHub"
          >
            <Icon name="github" className="w-6 h-6" />
          </a>
          <button 
            onClick={onPublish}
            disabled={!isProjectLoaded}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">
            Publish
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
