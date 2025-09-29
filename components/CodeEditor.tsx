
import React from 'react';
import { Icon } from './Icon';

interface CodeEditorProps {
  filePath: string;
  code: string;
  onCodeChange: (newCode: string) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ filePath, code, onCodeChange }) => {
  return (
    <div className="flex flex-col h-full bg-black/30">
       <div className="flex-shrink-0 p-3 border-b border-white/10">
        <h2 className="text-sm font-semibold flex items-center text-gray-300">
          <Icon name="code" className="w-4 h-4 mr-2" />
          <span className="font-mono text-purple-300">{filePath}</span>
        </h2>
      </div>
      <div className="flex-grow relative">
        <textarea
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          className="w-full h-full p-4 bg-transparent text-gray-300 font-mono text-sm resize-none focus:outline-none leading-relaxed"
          spellCheck="false"
          wrap="off"
          aria-label={`Code editor for ${filePath}`}
        />
      </div>
    </div>
  );
};

export default CodeEditor;