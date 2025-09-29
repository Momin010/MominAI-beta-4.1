#!/usr/bin/env node

/**
 * MominAI + Kilo Code Integration Script
 * 
 * This script demonstrates how to integrate Kilo Code's sophisticated agent
 * architecture with MominAI's full-stack platform.
 */

import { Agent, AgentOptions } from './core/agent/Agent'
import { buildApiHandler } from './core/api'

interface IntegrationConfig {
  apiProvider: 'gemini' | 'openai' | 'anthropic'
  apiKey: string
  workspacePath: string
  enableAdvancedFeatures: boolean
}

class MominAIKiloCodeIntegration {
  private agent: Agent | null = null
  private config: IntegrationConfig
  
  constructor(config: IntegrationConfig) {
    this.config = config
  }
  
  async initialize(): Promise<void> {
    console.log('🚀 Initializing MominAI with Kilo Code architecture...')
    
    const agentOptions: AgentOptions = {
      apiConfiguration: {
        apiProvider: this.config.apiProvider,
        apiKey: this.config.apiKey,
        apiModelId: this.getModelId()
      },
      workspacePath: this.config.workspacePath,
      enableDiff: true,
      enableCheckpoints: this.config.enableAdvancedFeatures,
      fuzzyMatchThreshold: 0.8,
      consecutiveMistakeLimit: 3,
      experiments: {
        autoApproval: this.config.enableAdvancedFeatures,
        multiFileApplyDiff: true,
        contextWindowManagement: true
      }
    }
    
    this.agent = new Agent(agentOptions)
    this.setupEventHandlers()
    
    console.log('✅ MominAI Enhanced agent initialized successfully!')
  }
  
  private getModelId(): string {
    switch (this.config.apiProvider) {
      case 'gemini':
        return 'gemini-1.5-pro'
      case 'openai':
        return 'gpt-4'
      case 'anthropic':
        return 'claude-3-sonnet-20240229'
      default:
        return 'gemini-pro'
    }
  }
  
  private setupEventHandlers(): void {
    if (!this.agent) return
    
    this.agent.on('message', (message) => {
      console.log(`📝 ${message.type.toUpperCase()}: ${message.content.substring(0, 100)}...`)
    })
    
    this.agent.on('tool_use', (toolName, args) => {
      console.log(`🔧 Tool used: ${toolName}`)
      if (args.path) console.log(`   Path: ${args.path}`)
      if (args.command) console.log(`   Command: ${args.command}`)
    })
    
    this.agent.on('error', (error) => {
      console.error(`❌ Error: ${error.message}`)
    })
    
    this.agent.on('status', (status) => {
      console.log(`📊 Status: ${status}`)
    })
    
    this.agent.on('completion', (result) => {
      console.log('🎉 Task completed successfully!')
    })
  }
  
  async runDemo(): Promise<void> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.')
    }
    
    console.log('\n🎯 Starting demo task...')
    
    const demoTask = `
    Create a simple TypeScript utility function that:
    1. Takes an array of numbers as input
    2. Returns the sum, average, min, and max values
    3. Includes proper TypeScript types
    4. Has comprehensive error handling
    5. Includes unit tests
    
    Save it as utils/mathUtils.ts and create tests in utils/__tests__/mathUtils.test.ts
    `
    
    await this.agent.start(demoTask)
    
    // Wait for completion or timeout
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('⏰ Demo timeout reached')
        resolve(void 0)
      }, 60000) // 1 minute timeout
      
      this.agent!.on('completion', () => {
        clearTimeout(timeout)
        resolve(void 0)
      })
    })
  }
  
  async createCheckpoint(): Promise<string | undefined> {
    if (!this.agent) return undefined
    
    console.log('💾 Creating checkpoint...')
    const checkpointId = await this.agent.createCheckpoint()
    
    if (checkpointId) {
      console.log(`✅ Checkpoint created: ${checkpointId}`)
    }
    
    return checkpointId
  }
  
  async cleanup(): Promise<void> {
    if (this.agent) {
      console.log('🧹 Cleaning up agent...')
      this.agent.dispose()
      this.agent = null
    }
  }
  
  getAgentStats(): any {
    if (!this.agent) return null
    
    return {
      status: this.agent.getStatus(),
      messageCount: this.agent.getMessages().length,
      agentId: this.agent.agentId
    }
  }
}

// Example usage
async function main() {
  const config: IntegrationConfig = {
    apiProvider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY || '',
    workspacePath: process.cwd(),
    enableAdvancedFeatures: true
  }
  
  if (!config.apiKey) {
    console.error('❌ Please set GEMINI_API_KEY environment variable')
    process.exit(1)
  }
  
  const integration = new MominAIKiloCodeIntegration(config)
  
  try {
    await integration.initialize()
    
    // Create initial checkpoint
    await integration.createCheckpoint()
    
    // Run demo task
    await integration.runDemo()
    
    // Show final stats
    console.log('\n📈 Final Stats:', integration.getAgentStats())
    
  } catch (error) {
    console.error('💥 Integration failed:', error)
  } finally {
    await integration.cleanup()
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { MominAIKiloCodeIntegration }
export type { IntegrationConfig }