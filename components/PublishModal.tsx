
import React, { useState, useEffect } from 'react';
import { Files } from '../types';
import { Icon } from './Icon';
import * as githubService from '../services/githubService';

interface PublishModalProps {
  projectName: string;
  files: Files;
  onClose: () => void;
}

type Step = 'token' | 'config' | 'publishing' | 'success' | 'error';

const PublishModal: React.FC<PublishModalProps> = ({ projectName, files, onClose }) => {
  const [step, setStep] = useState<Step>('token');
  const [token, setToken] = useState('');
  const [repoName, setRepoName] = useState(projectName.replace(/[^a-z0-9-]/gi, '-'));
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successUrl, setSuccessUrl] = useState('');
  const [githubUser, setGithubUser] = useState<any>(null);

  useEffect(() => {
    // Sanitize project name for repo name
    setRepoName(projectName.replace(/[^a-z0-9-]/gi, '-'));
  }, [projectName]);

  const handleConnect = async () => {
    if (!token) {
      setErrorMessage('Please enter a Personal Access Token.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      const user = await githubService.verifyToken(token);
      setGithubUser(user);
      setStep('config');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to verify token.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setStep('publishing');
    try {
      setStatusText('Creating repository...');
      const repo = await githubService.createRepo(token, repoName, isPrivate);
      setStatusText('Pushing files...');
      await githubService.pushFiles(token, githubUser.login, repoName, files, 'Initial commit from MominAI');
      setSuccessUrl(repo.html_url);
      setStep('success');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred during publishing.');
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetToConfig = () => {
    setStep('config');
    setErrorMessage('');
  };

  const renderContent = () => {
    switch (step) {
      case 'token':
        return (
          <>
            <h3 className="text-xl font-bold mb-2">Connect to GitHub</h3>
            <p className="text-sm text-gray-400 mb-4">
              To publish your project, please provide a GitHub Personal Access Token (PAT) with <code className="bg-white/10 px-1 py-0.5 rounded">repo</code> scope.
            </p>
            <a href="https://github.com/settings/tokens/new?scopes=repo&description=MominAI%20Project%20Publisher" target="_blank" rel="noopener noreferrer" className="text-sm text-purple-400 hover:underline mb-4 inline-block">
              Create a new token here
            </a>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_..."
              className="w-full bg-black/40 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 mb-4"
              aria-label="GitHub Personal Access Token"
            />
            {errorMessage && <p className="text-red-400 text-sm mb-4">{errorMessage}</p>}
            <button onClick={handleConnect} disabled={isLoading} className="w-full p-3 text-sm font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">
              {isLoading ? 'Connecting...' : 'Connect'}
            </button>
          </>
        );
      case 'config':
        return (
          <>
            <h3 className="text-xl font-bold mb-4">Configure Repository</h3>
            <div className="mb-4">
              <label htmlFor="repoName" className="block text-sm font-medium text-gray-400 mb-1">Repository Name</label>
              <input
                id="repoName"
                type="text"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                className="w-full bg-black/40 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="mb-6 flex items-center justify-between bg-black/40 rounded-lg p-3">
              <label htmlFor="repoVisibility" className="text-sm text-gray-400">Private Repository</label>
              <button onClick={() => setIsPrivate(!isPrivate)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPrivate ? 'bg-purple-600' : 'bg-gray-600'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <button onClick={handlePublish} disabled={isLoading} className="w-full p-3 text-sm font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">
              {isLoading ? 'Publishing...' : 'Create & Publish'}
            </button>
          </>
        );
      case 'publishing':
        return (
          <div className="text-center">
            <h3 className="text-xl font-bold mb-4">Publishing Project...</h3>
            <div className="dot-pulse flex space-x-2 justify-center my-4">
              <span className="w-2.5 h-2.5 bg-purple-300 rounded-full"></span>
              <span className="w-2.5 h-2.5 bg-purple-300 rounded-full"></span>
              <span className="w-2.5 h-2.5 bg-purple-300 rounded-full"></span>
            </div>
            <p className="text-gray-400">{statusText}</p>
          </div>
        );
      case 'success':
        return (
          <div className="text-center">
            <h3 className="text-xl font-bold mb-4 text-green-400">Published Successfully!</h3>
            <p className="text-gray-400 mb-6">Your project is now live on GitHub.</p>
            <a href={successUrl} target="_blank" rel="noopener noreferrer" className="w-full block p-3 text-sm font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors">
              View Repository
            </a>
          </div>
        );
      case 'error':
        return (
           <div className="text-center">
            <h3 className="text-xl font-bold mb-4 text-red-400">Publishing Failed</h3>
            <p className="text-gray-400 mb-6 bg-red-900/50 p-3 rounded-lg">{errorMessage}</p>
            <button onClick={resetToConfig} className="w-full p-3 text-sm font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors">
              Try Again
            </button>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-md bg-gray-800/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:bg-white/10 hover:text-white" aria-label="Close">
          <Icon name="close" className="w-5 h-5" />
        </button>
        {renderContent()}
      </div>
    </div>
  );
};

export default PublishModal;
