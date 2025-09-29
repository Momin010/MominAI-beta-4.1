import React from 'react';
import { Icon } from './Icon';

export interface ConsoleMessage {
  level: 'log' | 'warn' | 'error' | 'info';
  payload: any[];
}

interface DevToolsPanelProps {
  logs: ConsoleMessage[];
  onClear: () => void;
}

const levelClasses: Record<ConsoleMessage['level'], { text: string; bg: string }> = {
  log: { text: 'text-gray-200', bg: '' },
  info: { text: 'text-blue-300', bg: 'bg-blue-900/20' },
  warn: { text: 'text-yellow-300', bg: 'bg-yellow-900/20' },
  error: { text: 'text-red-400', bg: 'bg-red-900/20' },
};

const LogEntry: React.FC<{ message: ConsoleMessage }> = ({ message }) => {
  const { text, bg } = levelClasses[message.level];

  const formatArg = (arg: any) => {
    if (typeof arg === 'string') {
      try {
        // Pretty print if it's a JSON string
        const parsed = JSON.parse(arg);
        return JSON.stringify(parsed, null, 2);
      } catch (e) {
        return arg;
      }
    }
    if (typeof arg === 'object' && arg !== null) {
      if (arg.message && arg.stack) { // It's an Error object
        return `${arg.name}: ${arg.message}\n${arg.stack}`;
      }
      return JSON.stringify(arg, null, 2);
    }
    return String(arg);
  };
  
  return (
    <div className={`flex items-start gap-2 p-2 border-b border-white/5 font-mono text-xs ${bg}`}>
      <span className={`flex-shrink-0 font-semibold ${text}`}>{`[${message.level.toUpperCase()}]`}</span>
      <pre className={`whitespace-pre-wrap break-all ${text}`}>
        {message.payload.map(formatArg).join(' ')}
      </pre>
    </div>
  );
};

const DevToolsPanel: React.FC<DevToolsPanelProps> = ({ logs, onClear }) => {
  return (
    <div className="flex flex-col h-full bg-black/40 text-gray-300">
      <div className="flex-shrink-0 flex items-center justify-between p-2 border-b border-white/10">
        <h3 className="text-sm font-semibold">Console</h3>
        <button
          onClick={onClear}
          className="p-1.5 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
          aria-label="Clear console"
        >
          <Icon name="trash" className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-grow overflow-y-auto">
        {logs.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">Console is empty. Logs from the preview will appear here.</p>
        ) : (
          logs.map((log, index) => <LogEntry key={index} message={log} />)
        )}
      </div>
    </div>
  );
};

export default DevToolsPanel;
