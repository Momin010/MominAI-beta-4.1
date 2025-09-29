import React, { useState } from 'react';
import { Icon } from './Icon';

interface ModelConfig {
  id: string;
  name: string;
  provider: 'gemini' | 'openai' | 'anthropic';
  apiKeyRequired: boolean;
}

const AVAILABLE_MODELS: ModelConfig[] = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', apiKeyRequired: false },
  { id: 'gemini-pro', name: 'Gemini Pro', provider: 'gemini', apiKeyRequired: false },
  { id: 'gpt-4', name: 'GPT-4', provider: 'openai', apiKeyRequired: true },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', apiKeyRequired: true },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'anthropic', apiKeyRequired: true },
];

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  onApiKeyChange: (provider: string, apiKey: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ 
  selectedModel, 
  onModelChange, 
  onApiKeyChange 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showApiKeyInput, setShowApiKeyInput] = useState<string | null>(null);

  const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModel) || AVAILABLE_MODELS[0];

  const handleModelSelect = (model: ModelConfig) => {
    if (model.apiKeyRequired && !apiKeys[model.provider]) {
      setShowApiKeyInput(model.provider);
      return;
    }
    
    onModelChange(model.id);
    setIsOpen(false);
  };

  const handleApiKeySubmit = (provider: string, apiKey: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: apiKey }));
    onApiKeyChange(provider, apiKey);
    setShowApiKeyInput(null);
    
    // Select the first model of this provider
    const model = AVAILABLE_MODELS.find(m => m.provider === provider);
    if (model) {
      onModelChange(model.id);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
      >
        <span className="text-sm font-medium">{currentModel.name}</span>
        <Icon name="chevron-down" className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-2">
            {AVAILABLE_MODELS.map((model) => (
              <div key={model.id}>
                <button
                  onClick={() => handleModelSelect(model)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    model.id === selectedModel 
                      ? 'bg-blue-600 text-white' 
                      : 'hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{model.name}</span>
                    {model.apiKeyRequired && !apiKeys[model.provider] && (
                      <span className="text-xs text-yellow-400">API Key Required</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 capitalize">{model.provider}</div>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showApiKeyInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96">
            <h3 className="text-lg font-bold mb-4">
              Enter {showApiKeyInput.toUpperCase()} API Key
            </h3>
            <input
              type="password"
              placeholder={`${showApiKeyInput.toUpperCase()} API Key`}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const target = e.target as HTMLInputElement;
                  if (target.value.trim()) {
                    handleApiKeySubmit(showApiKeyInput, target.value.trim());
                  }
                }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const input = document.querySelector('input[type="password"]') as HTMLInputElement;
                  if (input?.value.trim()) {
                    handleApiKeySubmit(showApiKeyInput, input.value.trim());
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setShowApiKeyInput(null)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;