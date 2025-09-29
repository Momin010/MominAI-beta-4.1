import React, { useState, useEffect } from 'react';
import { decodeHtmlEntities } from '../utils/validation';
import { Icon } from './Icon';
import ResizablePanel from './ResizablePanel';
import DevToolsPanel, { ConsoleMessage } from './DevToolsPanel';

interface LivePreviewProps {
  htmlContent: string;
  isFullscreen?: boolean;
  onExitFullscreen?: () => void;
}

type Device = 'desktop' | 'tablet' | 'mobile';

const deviceStyles: Record<Device, React.CSSProperties> = {
  desktop: { width: '100%' },
  tablet: { width: '768px' },
  mobile: { width: '375px' },
};

const consoleInterceptorScript = `
  const originalConsole = { ...window.console };
  const levels = ['log', 'warn', 'error', 'info'];
  
  const serialize = (obj) => {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          return '[Circular]';
        }
        cache.add(value);
      }
      if (typeof value === 'function') {
        return \`[Function: \${value.name || 'anonymous'}]\`;
      }
      return value;
    }, 2);
  };

  levels.forEach(level => {
    window.console[level] = (...args) => {
      originalConsole[level](...args);
      try {
        const serializedArgs = args.map(arg => {
          if (arg instanceof Error) {
            return { message: arg.message, stack: arg.stack, name: arg.name };
          }
          if (typeof arg === 'object' && arg !== null) {
            return serialize(arg);
          }
          return arg;
        });
        window.parent.postMessage({
          source: 'mominai-preview-console',
          level: level,
          payload: serializedArgs,
        }, '*');
      } catch (e) {
        originalConsole.error('MominAI Console Interceptor Error:', e);
      }
    };
  });

  window.addEventListener('error', (e) => {
    window.console.error(e.message, 'at ' + e.filename + ':' + e.lineno);
  });
  
  window.addEventListener('unhandledrejection', (e) => {
    window.console.error('Unhandled Promise Rejection:', e.reason);
  });
`;


const LivePreview: React.FC<LivePreviewProps> = ({ htmlContent, isFullscreen = false, onExitFullscreen }) => {
  const isPlaceholder = !htmlContent || !htmlContent.trim();
  const [device, setDevice] = useState<Device>('desktop');
  const [consoleLogs, setConsoleLogs] = useState<ConsoleMessage[]>([]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.source === 'mominai-preview-console') {
        setConsoleLogs(prev => [...prev, { level: event.data.level, payload: event.data.payload }]);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    setConsoleLogs([]);
  }, [htmlContent]);

  const srcDoc = isPlaceholder ? '' : `<script>${consoleInterceptorScript}</script>${decodeHtmlEntities(htmlContent)}`;

  const deviceButtons: { name: Device, icon: string }[] = [
    { name: 'desktop', icon: 'desktop' },
    { name: 'tablet', icon: 'tablet' },
    { name: 'mobile', icon: 'mobile' },
  ];

  if (isPlaceholder) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-black/20 rounded-xl">
        <Icon name="eye" className="w-16 h-16 text-gray-600" />
        <h3 className="text-xl font-semibold mt-4">Live Preview</h3>
        <p>Your generated project preview will appear here.</p>
      </div>
    );
  }
  
  const containerClasses = isFullscreen
    ? "flex flex-col h-full bg-black relative"
    : "flex flex-col h-full bg-black/10";

  return (
    <div className={containerClasses}>
      {isFullscreen && (
        <button
          onClick={onExitFullscreen}
          className="absolute top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg bg-black/50 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 transition-colors"
          aria-label="Exit fullscreen"
        >
          <Icon name="fullscreen-exit" className="w-4 h-4" />
          <span>Exit (Esc)</span>
        </button>
      )}

      {!isFullscreen && (
        <div className="flex-shrink-0 flex items-center justify-center p-1.5 gap-2 bg-black/20 border-b border-white/10">
          {deviceButtons.map(({ name, icon }) => (
            <button
              key={name}
              onClick={() => setDevice(name)}
              className={`p-2 rounded-lg transition-colors ${
                device === name ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
              aria-label={`Switch to ${name} view`}
              aria-pressed={device === name}
            >
              <Icon name={icon} className="w-5 h-5" />
            </button>
          ))}
        </div>
      )}
      
      {isFullscreen ? (
        <div className="w-full h-full bg-white">
          <iframe
            key={htmlContent}
            srcDoc={srcDoc}
            title="Live Preview"
            className="w-full h-full border-0 bg-white"
            sandbox="allow-scripts allow-forms"
          />
        </div>
      ) : (
        <ResizablePanel direction="vertical" initialSize={window.innerHeight * 0.65} minSize={150}>
          <div className="w-full h-full bg-gray-800/50 flex justify-center overflow-auto p-4">
            <div style={deviceStyles[device]} className="h-full shadow-2xl bg-white flex-shrink-0 transition-all duration-300 ease-in-out">
              <iframe
                key={htmlContent} // Force re-render on content change
                srcDoc={srcDoc}
                title="Live Preview"
                className="w-full h-full border-0 bg-white"
                sandbox="allow-scripts allow-forms"
              />
            </div>
          </div>
          <DevToolsPanel logs={consoleLogs} onClear={() => setConsoleLogs([])} />
        </ResizablePanel>
      )}
    </div>
  );
};

export default LivePreview;
