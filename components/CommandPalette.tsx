import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Files } from '../types';
import { Icon } from './Icon';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  files: Files;
  onSelectFile: (path: string) => void;
  onDownloadProject: () => void;
  onPublish: () => void;
}

type ActionItem = {
  id: string;
  name: string;
  action: () => void;
  icon: string;
  type: 'command' | 'file';
};

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, files, onSelectFile, onDownloadProject, onPublish }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLUListElement>(null);

  const allItems: ActionItem[] = useMemo(() => {
    const commands: ActionItem[] = [
      { id: 'download', name: 'Download Project as ZIP', action: onDownloadProject, icon: 'code', type: 'command' },
      { id: 'publish', name: 'Publish to GitHub', action: onPublish, icon: 'github', type: 'command' },
    ];

    const fileItems: ActionItem[] = Object.keys(files).map(path => ({
      id: path,
      name: path,
      action: () => onSelectFile(path),
      icon: 'file',
      type: 'file',
    }));

    return [...commands, ...fileItems];
  }, [files, onDownloadProject, onPublish, onSelectFile]);

  const filteredItems = useMemo(() => {
    if (!query) return allItems;
    return allItems.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
  }, [query, allItems]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, filteredItems, selectedIndex]);

  useEffect(() => {
    // Scroll selected item into view
    if (resultsRef.current && filteredItems.length > 0) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLLIElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, filteredItems]);
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <div className="relative w-full max-w-xl bg-gray-800/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="relative">
          <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search files and commands..."
            className="w-full bg-transparent p-4 pl-12 text-lg text-white focus:outline-none"
          />
        </div>
        <hr className="border-white/10" />
        {filteredItems.length > 0 ? (
          <ul ref={resultsRef} className="max-h-96 overflow-y-auto p-2">
            {filteredItems.map((item, index) => (
              <li
                key={item.id}
                onClick={() => {
                  item.action();
                  onClose();
                }}
                onMouseMove={() => setSelectedIndex(index)}
                className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer ${
                  selectedIndex === index ? 'bg-purple-600/50' : 'hover:bg-white/5'
                }`}
                role="option"
                aria-selected={selectedIndex === index}
              >
                <Icon name={item.icon} className="w-5 h-5 text-gray-300 flex-shrink-0" />
                <span className="text-sm text-gray-200 truncate">{item.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-center text-gray-400">No results found.</p>
        )}
      </div>
    </div>
  );
};

export default CommandPalette;
