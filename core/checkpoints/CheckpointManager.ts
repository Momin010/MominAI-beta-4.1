import { EventEmitter } from 'events'
import * as fs from 'fs/promises'
import * as path from 'path'
import crypto from 'crypto'

export interface Checkpoint {
  id: string
  timestamp: number
  description: string
  agentId: string
  workspacePath: string
  files: Array<{
    path: string
    content: string
    hash: string
  }>
  metadata?: Record<string, any>
}

export interface CheckpointDiff {
  added: string[]
  modified: string[]
  deleted: string[]
  details: Array<{
    path: string
    type: 'added' | 'modified' | 'deleted'
    oldContent?: string
    newContent?: string
  }>
}

export class CheckpointManager extends EventEmitter {
  private workspacePath: string
  private agentId: string
  private checkpointsDir: string
  private checkpoints: Map<string, Checkpoint> = new Map()
  
  constructor(workspacePath: string, agentId: string) {
    super()
    this.workspacePath = workspacePath
    this.agentId = agentId
    this.checkpointsDir = path.join(workspacePath, '.mominai', 'checkpoints')
    
    this.initialize()
  }
  
  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.checkpointsDir, { recursive: true })
      await this.loadExistingCheckpoints()
    } catch (error) {
      console.error('Failed to initialize checkpoint manager:', error)
    }
  }
  
  private async loadExistingCheckpoints(): Promise<void> {
    try {
      const files = await fs.readdir(this.checkpointsDir)
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const checkpointPath = path.join(this.checkpointsDir, file)
          const content = await fs.readFile(checkpointPath, 'utf-8')
          const checkpoint: Checkpoint = JSON.parse(content)
          
          if (checkpoint.agentId === this.agentId) {
            this.checkpoints.set(checkpoint.id, checkpoint)
          }
        }
      }
    } catch (error) {
      // Directory might not exist yet
    }
  }
  
  public async createCheckpoint(description?: string): Promise<string> {
    const checkpointId = crypto.randomUUID()
    const timestamp = Date.now()
    
    try {
      // Scan workspace for files
      const files = await this.scanWorkspaceFiles()
      
      const checkpoint: Checkpoint = {
        id: checkpointId,
        timestamp,
        description: description || `Checkpoint ${new Date(timestamp).toISOString()}`,
        agentId: this.agentId,
        workspacePath: this.workspacePath,
        files
      }
      
      // Save checkpoint to disk
      const checkpointPath = path.join(this.checkpointsDir, `${checkpointId}.json`)
      await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2))
      
      // Store in memory
      this.checkpoints.set(checkpointId, checkpoint)
      
      this.emit('checkpoint_created', checkpoint)
      
      return checkpointId
    } catch (error) {
      this.emit('checkpoint_error', error)
      throw error
    }
  }
  
  private async scanWorkspaceFiles(): Promise<Array<{ path: string; content: string; hash: string }>> {
    const files: Array<{ path: string; content: string; hash: string }> = []
    
    await this.scanDirectory(this.workspacePath, files)
    
    return files
  }
  
  private async scanDirectory(dir: string, files: Array<{ path: string; content: string; hash: string }>): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        
        // Skip certain directories and files
        if (this.shouldSkip(entry.name, fullPath)) {
          continue
        }
        
        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, files)
        } else if (entry.isFile()) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8')
            const relativePath = path.relative(this.workspacePath, fullPath)
            const hash = crypto.createHash('sha256').update(content).digest('hex')
            
            files.push({
              path: relativePath,
              content,
              hash
            })
          } catch (error) {
            // Skip files that can't be read (binary files, permission issues, etc.)
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }
  
  private shouldSkip(name: string, fullPath: string): boolean {
    const skipPatterns = [
      /^\.git$/,
      /^node_modules$/,
      /^\.mominai$/,
      /^dist$/,
      /^build$/,
      /^coverage$/,
      /^\.next$/,
      /^\.nuxt$/,
      /^\.vscode$/,
      /^\.idea$/,
      /^\./  // Hidden files
    ]
    
    return skipPatterns.some(pattern => pattern.test(name))
  }
  
  public async restoreCheckpoint(checkpointId: string): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId)
    
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`)
    }
    
    try {
      // Get current state for comparison
      const currentFiles = await this.scanWorkspaceFiles()
      const currentFileMap = new Map(currentFiles.map(f => [f.path, f]))
      
      // Restore files from checkpoint
      for (const file of checkpoint.files) {
        const fullPath = path.join(this.workspacePath, file.path)
        
        // Ensure directory exists
        await fs.mkdir(path.dirname(fullPath), { recursive: true })
        
        // Write file content
        await fs.writeFile(fullPath, file.content, 'utf-8')
      }
      
      // Remove files that weren't in the checkpoint
      for (const [filePath] of currentFileMap) {
        const existsInCheckpoint = checkpoint.files.some(f => f.path === filePath)
        
        if (!existsInCheckpoint) {
          const fullPath = path.join(this.workspacePath, filePath)
          try {
            await fs.unlink(fullPath)
          } catch (error) {
            // File might already be deleted
          }
        }
      }
      
      this.emit('checkpoint_restored', checkpoint)
    } catch (error) {
      this.emit('checkpoint_error', error)
      throw error
    }
  }
  
  public async compareCheckpoints(checkpointId1: string, checkpointId2: string): Promise<CheckpointDiff> {
    const checkpoint1 = this.checkpoints.get(checkpointId1)
    const checkpoint2 = this.checkpoints.get(checkpointId2)
    
    if (!checkpoint1 || !checkpoint2) {
      throw new Error('One or both checkpoints not found')
    }
    
    return this.calculateDiff(checkpoint1, checkpoint2)
  }
  
  public async compareWithCurrent(checkpointId: string): Promise<CheckpointDiff> {
    const checkpoint = this.checkpoints.get(checkpointId)
    
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`)
    }
    
    const currentFiles = await this.scanWorkspaceFiles()
    const currentCheckpoint: Checkpoint = {
      id: 'current',
      timestamp: Date.now(),
      description: 'Current state',
      agentId: this.agentId,
      workspacePath: this.workspacePath,
      files: currentFiles
    }
    
    return this.calculateDiff(checkpoint, currentCheckpoint)
  }
  
  private calculateDiff(checkpoint1: Checkpoint, checkpoint2: Checkpoint): CheckpointDiff {
    const files1 = new Map(checkpoint1.files.map(f => [f.path, f]))
    const files2 = new Map(checkpoint2.files.map(f => [f.path, f]))
    
    const added: string[] = []
    const modified: string[] = []
    const deleted: string[] = []
    const details: CheckpointDiff['details'] = []
    
    // Find added and modified files
    for (const [path, file2] of files2) {
      const file1 = files1.get(path)
      
      if (!file1) {
        added.push(path)
        details.push({
          path,
          type: 'added',
          newContent: file2.content
        })
      } else if (file1.hash !== file2.hash) {
        modified.push(path)
        details.push({
          path,
          type: 'modified',
          oldContent: file1.content,
          newContent: file2.content
        })
      }
    }
    
    // Find deleted files
    for (const [path, file1] of files1) {
      if (!files2.has(path)) {
        deleted.push(path)
        details.push({
          path,
          type: 'deleted',
          oldContent: file1.content
        })
      }
    }
    
    return { added, modified, deleted, details }
  }
  
  public getCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values()).sort((a, b) => b.timestamp - a.timestamp)
  }
  
  public getCheckpoint(checkpointId: string): Checkpoint | undefined {
    return this.checkpoints.get(checkpointId)
  }
  
  public async deleteCheckpoint(checkpointId: string): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId)
    
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`)
    }
    
    try {
      // Delete from disk
      const checkpointPath = path.join(this.checkpointsDir, `${checkpointId}.json`)
      await fs.unlink(checkpointPath)
      
      // Remove from memory
      this.checkpoints.delete(checkpointId)
      
      this.emit('checkpoint_deleted', checkpoint)
    } catch (error) {
      this.emit('checkpoint_error', error)
      throw error
    }
  }
  
  public async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now()
    const checkpointsToDelete: string[] = []
    
    for (const [id, checkpoint] of this.checkpoints) {
      if (now - checkpoint.timestamp > maxAge) {
        checkpointsToDelete.push(id)
      }
    }
    
    for (const id of checkpointsToDelete) {
      await this.deleteCheckpoint(id)
    }
    
    this.emit('cleanup_completed', { deleted: checkpointsToDelete.length })
  }
  
  public dispose(): void {
    this.removeAllListeners()
    this.checkpoints.clear()
  }
}