import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { codeIntelligence, type ProjectAnalysis, type CodeIssue, type Suggestion } from '../services/codeIntelligence';
import type { Files } from '../types';

interface CodeIntelligencePanelProps {
  files: Files;
  activeFile: string;
  onSelectFile: (path: string) => void;
}

const CodeIntelligencePanel: React.FC<CodeIntelligencePanelProps> = ({
  files,
  activeFile,
  onSelectFile
}) => {
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'issues' | 'suggestions'>('overview');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    analyzeProject();
  }, [files]);

  const analyzeProject = async () => {
    setIsAnalyzing(true);
    try {
      codeIntelligence.updateProject(files);
      const projectAnalysis = codeIntelligence.analyzeProjectStructure();
      setAnalysis(projectAnalysis);
    } catch (error) {
      console.error('Error analyzing project:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityColor = (type: CodeIssue['type']) => {
    switch (type) {
      case 'error': return 'text-red-400 bg-red-400/10';
      case 'warning': return 'text-yellow-400 bg-yellow-400/10';
      case 'info': return 'text-blue-400 bg-blue-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getSeverityIcon = (type: CodeIssue['type']) => {
    switch (type) {
      case 'error': return 'alert-circle';
      case 'warning': return 'alert-triangle';
      case 'info': return 'info';
      default: return 'help-circle';
    }
  };

  if (!analysis) {
    return (
      <div className="h-full bg-black/20 backdrop-blur-lg border border-white/10 rounded-2xl p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Analyzing project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-black/20 backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Code Intelligence</h3>
          <button
            onClick={analyzeProject}
            disabled={isAnalyzing}
            className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-50"
          >
            <Icon name="refresh-cw" className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-black/20 p-1 rounded-xl">
          {[
            { id: 'overview', label: 'Overview', icon: 'bar-chart' },
            { id: 'issues', label: 'Issues', icon: 'alert-triangle', count: analysis.issues.length },
            { id: 'suggestions', label: 'Tips', icon: 'lightbulb', count: analysis.suggestions.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                activeTab === tab.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              <Icon name={tab.icon as any} className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Project Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/30 p-4 rounded-xl">
                <div className="text-2xl font-bold text-white">{Object.keys(files).length}</div>
                <div className="text-sm text-gray-400">Files</div>
              </div>
              <div className="bg-black/30 p-4 rounded-xl">
                <div className="text-2xl font-bold text-white">{analysis.dependencies.length}</div>
                <div className="text-sm text-gray-400">Dependencies</div>
              </div>
            </div>

            {/* Architecture */}
            <div className="bg-black/30 p-4 rounded-xl">
              <h4 className="font-semibold text-white mb-2">Architecture</h4>
              <p className="text-gray-300">{analysis.architecture}</p>
            </div>

            {/* Frameworks */}
            {analysis.frameworks.length > 0 && (
              <div className="bg-black/30 p-4 rounded-xl">
                <h4 className="font-semibold text-white mb-3">Frameworks & Libraries</h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.frameworks.map(framework => (
                    <span
                      key={framework}
                      className="px-3 py-1 bg-purple-600/20 text-purple-300 rounded-full text-sm"
                    >
                      {framework}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Dependencies */}
            {analysis.dependencies.length > 0 && (
              <div className="bg-black/30 p-4 rounded-xl">
                <h4 className="font-semibold text-white mb-3">Dependencies</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {analysis.dependencies.map(dep => (
                    <div key={dep} className="text-sm text-gray-300 font-mono">
                      {dep}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'issues' && (
          <div className="space-y-3">
            {analysis.issues.length === 0 ? (
              <div className="text-center py-8">
                <Icon name="check-circle" className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-gray-400">No issues found!</p>
              </div>
            ) : (
              analysis.issues.map((issue, index) => (
                <div
                  key={index}
                  className="bg-black/30 p-4 rounded-xl cursor-pointer hover:bg-black/40 transition-colors"
                  onClick={() => onSelectFile(issue.file)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-1 rounded ${getSeverityColor(issue.type)}`}>
                      <Icon name={getSeverityIcon(issue.type) as any} className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium">{issue.message}</span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {issue.file}:{issue.line}
                      </div>
                      {issue.fix && (
                        <div className="mt-2 text-sm text-blue-300">
                          💡 {issue.fix}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'suggestions' && (
          <div className="space-y-3">
            {analysis.suggestions.length === 0 ? (
              <div className="text-center py-8">
                <Icon name="lightbulb" className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
                <p className="text-gray-400">No suggestions at the moment</p>
              </div>
            ) : (
              analysis.suggestions.map((suggestion, index) => (
                <div key={index} className="bg-black/30 p-4 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Icon name="lightbulb" className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <p className="text-gray-300">{suggestion}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeIntelligencePanel;