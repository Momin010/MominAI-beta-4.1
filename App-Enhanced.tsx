import React, { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Settings, FileText, Terminal, GitBranch, Zap, Save, RotateCcw } from 'lucide-react'
import { Agent, AgentOptions, AgentMessage } from './core/agent/Agent'
import { buildApiHandler } from './core/api'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  images?: string[]
  metadata?: Record<string, any>
}

interface AgentStatus {
  status: string
  isRunning: boolean
  consecutiveMistakes: number
  toolsUsed: string[]
  tokensUsed: number
}

const MominAI: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({
    status: 'idle',
    isRunning: false,
    consecutiveMistakes: 0,
    toolsUsed: [],
    tokensUsed: 0
  })
  
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '')
  const [selectedModel, setSelectedModel] = useState('gemini-pro')
  const [workspacePath, setWorkspacePath] = useState(process.cwd())
  const [showSettings, setShowSettings] = useState(false)
  const [autoApproval, setAutoApproval] = useState(false)
  const [enableCheckpoints, setEnableCheckpoints] = useState(true)
  
  const agentRef = useRef<Agent | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  useEffect(() => {
    // Initialize agent when settings change
    if (apiKey && workspacePath) {
      initializeAgent()
    }
    
    return () => {
      if (agentRef.current) {
        agentRef.current.dispose()
      }
    }
  }, [apiKey, selectedModel, workspacePath, autoApproval, enableCheckpoints])
  
  const initializeAgent = () => {
    if (agentRef.current) {
      agentRef.current.dispose()
    }
    
    const agentOptions: AgentOptions = {
      apiConfiguration: {
        apiProvider: 'gemini',
        apiKey: apiKey,
        apiModelId: selectedModel
      },
      workspacePath: workspacePath,
      enableDiff: true,
      enableCheckpoints: enableCheckpoints,
      fuzzyMatchThreshold: 0.8,
      consecutiveMistakeLimit: 3,
      experiments: {
        autoApproval: autoApproval
      }
    }
    
    const agent = new Agent(agentOptions)
    
    // Set up event listeners
    agent.on('message', (message: AgentMessage) => {
      setMessages(prev => [...prev, {
        id: message.id,
        type: message.type,
        content: message.content,
        timestamp: message.timestamp,
        metadata: message.metadata
      }])
    })
    
    agent.on('status', (status: string) => {
      setAgentStatus(prev => ({
        ...prev,
        status,
        isRunning: status === 'running' || status === 'starting'
      }))
    })
    
    agent.on('tool_use', (toolName: string, args: any) => {
      setAgentStatus(prev => ({
        ...prev,
        toolsUsed: [...prev.toolsUsed, toolName]
      }))
    })
    
    agent.on('error', (error: Error) => {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'system',
        content: `Error: ${error.message}`,
        timestamp: Date.now()
      }])
      
      setAgentStatus(prev => ({
        ...prev,
        consecutiveMistakes: prev.consecutiveMistakes + 1
      }))
    })
    
    agent.on('completion', (result: any) => {
      setAgentStatus(prev => ({
        ...prev,
        status: 'completed',
        isRunning: false
      }))
    })
    
    agentRef.current = agent
  }
  
  const handleSendMessage = async () => {
    if (!input.trim() || !agentRef.current) return
    
    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)
    
    try {
      if (!agentStatus.isRunning) {
        // Start new conversation
        await agentRef.current.start(userMessage)
      } else {
        // Send message to running agent
        await agentRef.current.sendMessage(userMessage)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'system',
        content: `Error: ${error.message}`,
        timestamp: Date.now()
      }])
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleAbortAgent = async () => {
    if (agentRef.current) {
      await agentRef.current.abort()
    }
  }
  
  const handleCreateCheckpoint = async () => {
    if (agentRef.current) {
      try {
        const checkpointId = await agentRef.current.createCheckpoint()
        if (checkpointId) {
          setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            type: 'system',
            content: `Checkpoint created: ${checkpointId}`,
            timestamp: Date.now()
          }])
        }
      } catch (error) {
        console.error('Error creating checkpoint:', error)
      }
    }
  }
  
  const handleClearMessages = () => {
    setMessages([])
    setAgentStatus({
      status: 'idle',
      isRunning: false,
      consecutiveMistakes: 0,
      toolsUsed: [],
      tokensUsed: 0
    })
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-500'
      case 'starting': return 'text-yellow-500'
      case 'error': return 'text-red-500'
      case 'completed': return 'text-blue-500'
      case 'aborted': return 'text-gray-500'
      default: return 'text-gray-400'
    }
  }
  
  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'user': return <User className="w-5 h-5" />
      case 'assistant': return <Bot className="w-5 h-5" />
      case 'tool': return <Terminal className="w-5 h-5" />
      case 'system': return <Settings className="w-5 h-5" />
      default: return <FileText className="w-5 h-5" />
    }
  }
  
  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold">MominAI Enhanced</h1>
          </div>
          
          {/* Agent Status */}
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Agent Status</span>
              <span className={`text-sm font-medium ${getStatusColor(agentStatus.status)}`}>
                {agentStatus.status}
              </span>
            </div>
            
            <div className="space-y-1 text-xs text-gray-400">
              <div>Mistakes: {agentStatus.consecutiveMistakes}/3</div>
              <div>Tools Used: {agentStatus.toolsUsed.length}</div>
              <div>Tokens: {agentStatus.tokensUsed}</div>
            </div>
          </div>
        </div>
        
        {/* Controls */}
        <div className="p-4 space-y-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          
          <button
            onClick={handleCreateCheckpoint}
            disabled={!enableCheckpoints || !agentStatus.isRunning}
            className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            Create Checkpoint
          </button>
          
          <button
            onClick={handleAbortAgent}
            disabled={!agentStatus.isRunning}
            className="w-full flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Abort Agent
          </button>
          
          <button
            onClick={handleClearMessages}
            className="w-full flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4" />
            Clear Messages
          </button>
        </div>
        
        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 border-t border-gray-700 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  localStorage.setItem('gemini_api_key', e.target.value)
                }}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                placeholder="Enter Gemini API key"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="gemini-pro">Gemini Pro</option>
                <option value="gemini-pro-vision">Gemini Pro Vision</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Workspace Path</label>
              <input
                type="text"
                value={workspacePath}
                onChange={(e) => setWorkspacePath(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                placeholder="Enter workspace path"
              />
            </div>
            
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoApproval}
                  onChange={(e) => setAutoApproval(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Auto Approval</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enableCheckpoints}
                  onChange={(e) => setEnableCheckpoints(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Enable Checkpoints</span>
              </label>
            </div>
          </div>
        )}
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">Welcome to MominAI Enhanced</p>
                <p className="text-sm">Powered by Kilo Code's sophisticated agent architecture</p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`flex gap-3 max-w-3xl ${
                    message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.type === 'user' 
                      ? 'bg-blue-600' 
                      : message.type === 'assistant'
                      ? 'bg-green-600'
                      : message.type === 'tool'
                      ? 'bg-purple-600'
                      : 'bg-gray-600'
                  }`}>
                    {getMessageIcon(message.type)}
                  </div>
                  
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      message.type === 'user'
                        ? 'bg-blue-600 text-white'
                        : message.type === 'assistant'
                        ? 'bg-gray-700 text-white'
                        : message.type === 'tool'
                        ? 'bg-purple-700 text-white'
                        : 'bg-gray-600 text-gray-200'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {message.metadata && (
                      <div className="mt-2 text-xs opacity-70">
                        {JSON.stringify(message.metadata, null, 2)}
                      </div>
                    )}
                    <div className="text-xs opacity-50 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area */}
        <div className="border-t border-gray-700 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          
          {isLoading && (
            <div className="mt-2 text-sm text-gray-400 flex items-center gap-2">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              Agent is processing...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MominAI