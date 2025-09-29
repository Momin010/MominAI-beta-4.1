import { EventEmitter } from 'events'
import * as fs from 'fs/promises'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface ToolResult {
  toolName: string
  content: string
  success: boolean
  error?: string
}

export interface ToolExecutorEvents {
  'tool_use': (toolName: string, args: any) => void
  'tool_result': (result: ToolResult) => void
}

export class ToolExecutor extends EventEmitter {
  private workspacePath: string
  private agent: any
  
  constructor(workspacePath: string, agent: any) {
    super()
    this.workspacePath = workspacePath
    this.agent = agent
  }
  
  public async executeTools(content: string): Promise<ToolResult[]> {
    const results: ToolResult[] = []
    
    // Parse tool uses from content
    const toolUses = this.parseToolUses(content)
    
    for (const toolUse of toolUses) {
      try {
  this.emit('tool_use', toolUse.name, toolUse.args)
        
        const result = await this.executeTool(toolUse.name, toolUse.args)
        results.push(result)
        
  this.emit('tool_result', result)
      } catch (error) {
        const errorResult: ToolResult = {
          toolName: toolUse.name,
          content: `Error executing ${toolUse.name}: ${error.message}`,
          success: false,
          error: error.message
        }
        results.push(errorResult)
  this.emit('tool_result', errorResult)
      }
    }
    
    return results
  }
  
  private parseToolUses(content: string): Array<{ name: string; args: any }> {
    const toolUses: Array<{ name: string; args: any }> = []
    
    // Parse XML-style tool tags
    const toolRegex = /<(\w+)>(.*?)<\/\1>/gs
    let match
    
    while ((match = toolRegex.exec(content)) !== null) {
      const toolName = match[1]
      const toolContent = match[2].trim()
      
      // Parse arguments from tool content
      const args = this.parseToolArgs(toolContent)
      
      toolUses.push({ name: toolName, args })
    }
    
    return toolUses
  }
  
  private parseToolArgs(content: string): any {
    const args: any = {}
    
    // Parse nested XML tags for arguments
    const argRegex = /<(\w+)>(.*?)<\/\1>/gs
    let match
    
    while ((match = argRegex.exec(content)) !== null) {
      args[match[1]] = match[2].trim()
    }
    
    return args
  }
  
  private async executeTool(toolName: string, args: any): Promise<ToolResult> {
    switch (toolName) {
      case 'read_file':
        return this.readFile(args.path)
      
      case 'write_file':
        return this.writeFile(args.path, args.content)
      
      case 'execute_command':
        return this.executeCommand(args.command)
      
      case 'list_files':
        return this.listFiles(args.path || '.')
      
      case 'search_files':
        return this.searchFiles(args.query, args.path)
      
      case 'apply_diff':
        return this.applyDiff(args.path, args.diff)
      
      case 'ask_followup':
        return this.askFollowup(args.question)
      
      case 'attempt_completion':
        return this.attemptCompletion(args.result)
      
      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  }
  
  private async readFile(filePath: string): Promise<ToolResult> {
    try {
      const fullPath = path.resolve(this.workspacePath, filePath)
      const content = await fs.readFile(fullPath, 'utf-8')
      
      return {
        toolName: 'read_file',
        content: `File content of ${filePath}:\n\n${content}`,
        success: true
      }
    } catch (error) {
      return {
        toolName: 'read_file',
        content: `Error reading file ${filePath}: ${error.message}`,
        success: false,
        error: error.message
      }
    }
  }
  
  private async writeFile(filePath: string, content: string): Promise<ToolResult> {
    try {
      const fullPath = path.resolve(this.workspacePath, filePath)
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      
      await fs.writeFile(fullPath, content, 'utf-8')
      
      return {
        toolName: 'write_file',
        content: `Successfully wrote to ${filePath}`,
        success: true
      }
    } catch (error) {
      return {
        toolName: 'write_file',
        content: `Error writing file ${filePath}: ${error.message}`,
        success: false,
        error: error.message
      }
    }
  }
  
  private async executeCommand(command: string): Promise<ToolResult> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workspacePath,
        timeout: 30000 // 30 second timeout
      })
      
      const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '')
      
      return {
        toolName: 'execute_command',
        content: `Command: ${command}\n\nOutput:\n${output}`,
        success: true
      }
    } catch (error) {
      return {
        toolName: 'execute_command',
        content: `Error executing command "${command}": ${error.message}`,
        success: false,
        error: error.message
      }
    }
  }
  
  private async listFiles(dirPath: string): Promise<ToolResult> {
    try {
      const fullPath = path.resolve(this.workspacePath, dirPath)
      const entries = await fs.readdir(fullPath, { withFileTypes: true })
      
      const files = entries
        .map(entry => `${entry.isDirectory() ? '[DIR]' : '[FILE]'} ${entry.name}`)
        .join('\n')
      
      return {
        toolName: 'list_files',
        content: `Files in ${dirPath}:\n\n${files}`,
        success: true
      }
    } catch (error) {
      return {
        toolName: 'list_files',
        content: `Error listing files in ${dirPath}: ${error.message}`,
        success: false,
        error: error.message
      }
    }
  }
  
  private async searchFiles(query: string, searchPath?: string): Promise<ToolResult> {
    try {
      const searchDir = searchPath ? path.resolve(this.workspacePath, searchPath) : this.workspacePath
      const results = await this.searchInDirectory(searchDir, query)
      
      return {
        toolName: 'search_files',
        content: `Search results for "${query}":\n\n${results.join('\n')}`,
        success: true
      }
    } catch (error) {
      return {
        toolName: 'search_files',
        content: `Error searching for "${query}": ${error.message}`,
        success: false,
        error: error.message
      }
    }
  }
  
  private async searchInDirectory(dir: string, query: string): Promise<string[]> {
    const results: string[] = []
    const entries = await fs.readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const subResults = await this.searchInDirectory(fullPath, query)
        results.push(...subResults)
      } else if (entry.isFile()) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8')
          if (content.toLowerCase().includes(query.toLowerCase())) {
            const relativePath = path.relative(this.workspacePath, fullPath)
            results.push(relativePath)
          }
        } catch {
          // Skip files that can't be read
        }
      }
    }
    
    return results
  }
  
  private async applyDiff(filePath: string, diff: string): Promise<ToolResult> {
    // Simplified diff application - would need proper diff parsing in production
    try {
      const fullPath = path.resolve(this.workspacePath, filePath)
      const currentContent = await fs.readFile(fullPath, 'utf-8')
      
      // This is a very basic diff application - would need proper implementation
      const newContent = this.applySimpleDiff(currentContent, diff)
      
      await fs.writeFile(fullPath, newContent, 'utf-8')
      
      return {
        toolName: 'apply_diff',
        content: `Successfully applied diff to ${filePath}`,
        success: true
      }
    } catch (error) {
      return {
        toolName: 'apply_diff',
        content: `Error applying diff to ${filePath}: ${error.message}`,
        success: false,
        error: error.message
      }
    }
  }
  
  private applySimpleDiff(content: string, diff: string): string {
    // Very basic diff application - would need proper diff parsing
    const lines = content.split('\n')
    const diffLines = diff.split('\n')
    
    // This is a placeholder - real diff application would be much more complex
    return content + '\n' + diff
  }
  
  private async askFollowup(question: string): Promise<ToolResult> {
    // This would integrate with the UI to ask the user a question
    return {
      toolName: 'ask_followup',
      content: `Asked user: ${question}`,
      success: true
    }
  }
  
  private async attemptCompletion(result: string): Promise<ToolResult> {
    return {
      toolName: 'attempt_completion',
      content: `Task completed: ${result}`,
      success: true
    }
  }
  
  public dispose(): void {
    this.removeAllListeners()
  }
}