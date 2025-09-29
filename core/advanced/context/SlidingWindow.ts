// Sliding window context management from Kilo Code
export interface TruncateOptions {
  messages: any[]
  totalTokens: number
  maxTokens: number
  contextWindow: number
  autoCondenseContext?: boolean
  autoCondenseContextPercent?: number
  systemPrompt?: string
  taskId?: string
}

export interface TruncateResult {
  messages: any[]
  summary?: string
  cost?: number
  newContextTokens?: number
  prevContextTokens?: number
  error?: string
}

export async function truncateConversationIfNeeded(options: TruncateOptions): Promise<TruncateResult> {
  const {
    messages,
    totalTokens,
    maxTokens,
    contextWindow,
    autoCondenseContext = true,
    autoCondenseContextPercent = 75,
    systemPrompt,
    taskId
  } = options
  
  // Check if truncation is needed
  const availableTokens = contextWindow - maxTokens
  
  if (totalTokens <= availableTokens) {
    return { messages } // No truncation needed
  }
  
  console.log(`Context window management: ${totalTokens} tokens > ${availableTokens} available`)
  
  if (autoCondenseContext) {
    // Condense conversation by keeping percentage
    const keepPercent = autoCondenseContextPercent / 100
    const keepCount = Math.floor(messages.length * keepPercent)
    const truncatedMessages = messages.slice(-keepCount)
    
    // Generate summary of removed messages
    const removedMessages = messages.slice(0, messages.length - keepCount)
    const summary = await generateSummary(removedMessages, systemPrompt)
    
    return {
      messages: truncatedMessages,
      summary,
      newContextTokens: estimateTokens(truncatedMessages),
      prevContextTokens: totalTokens,
      cost: 0 // Would calculate actual cost
    }
  }
  
  // Simple truncation - keep last 75% of messages
  const keepCount = Math.floor(messages.length * 0.75)
  const truncatedMessages = messages.slice(-keepCount)
  
  return {
    messages: truncatedMessages,
    newContextTokens: estimateTokens(truncatedMessages),
    prevContextTokens: totalTokens
  }
}

async function generateSummary(messages: any[], systemPrompt?: string): Promise<string> {
  // Generate summary of conversation
  const messageText = messages.map(m => `${m.role}: ${m.content}`).join('\n')
  
  return `Summary of ${messages.length} messages:\n${messageText.substring(0, 500)}...`
}

function estimateTokens(messages: any[]): number {
  return messages.reduce((total, msg) => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    return total + Math.ceil(content.length / 4)
  }, 0)
}