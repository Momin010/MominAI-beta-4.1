import { EventEmitter } from 'events'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface FileContext {
  path: string
  content: string
  size: number
  lastModified: number
  type: 'file' | 'directory'
}

export interface ProjectContext {
  workspacePath: string
  files: FileContext[]
  structure: any
  packageInfo?: any
  gitInfo?: any
  diagnostics?: any[]
}

export class ContextManager extends EventEmitter {
  private workspacePath: string
  private fileCache = new Map<string, FileContext>()
  private watchedFiles = new Set<string>()
  
  constructor(workspacePath: string) {
    super()
    this.workspacePath = workspacePath
  }
  
  public async getContext(): Promise<ProjectContext> {
    const files = await this.getRelevantFiles()
    const structure = await this.getProjectStructure()
    const packageInfo = await this.getPackageInfo()
    const gitInfo = await this.getGitInfo()
    
    return {
      workspacePath: this.workspacePath,
      files,
      structure,
      packageInfo,
      gitInfo
    }
  }
  
  private async getRelevantFiles(): Promise<FileContext[]> {
    const relevantFiles: FileContext[] = []
    
    try {
      const entries = await this.scanDirectory(this.workspacePath, 2) // Max depth 2
      
      for (const entry of entries) {
        if (this.isRelevantFile(entry.path)) {
          const context = await this.getFileContext(entry.path)
          if (context) {
            relevantFiles.push(context)
          }
        }
      }
    } catch (error) {
      console.error('Error getting relevant files:', error)
    }
    
    return relevantFiles
  }
  
  private async scanDirectory(dir: string, maxDepth: number, currentDepth = 0): Promise<Array<{ path: string; isDirectory: boolean }>> {
    if (currentDepth >= maxDepth) {
      return []
    }
    
    const results: Array<{ path: string; isDirectory: boolean }> = []
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        
        // Skip hidden files and common ignore patterns
        if (this.shouldIgnore(entry.name)) {
          continue
        }
        
        if (entry.isDirectory()) {
          results.push({ path: fullPath, isDirectory: true })
          const subResults = await this.scanDirectory(fullPath, maxDepth, currentDepth + 1)
          results.push(...subResults)
        } else {
          results.push({ path: fullPath, isDirectory: false })
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
    
    return results
  }
  
  private shouldIgnore(name: string): boolean {
    const ignorePatterns = [
      /^\./,  // Hidden files
      /^node_modules$/,
      /^\.git$/,
      /^dist$/,
      /^build$/,
      /^coverage$/,
      /^\.next$/,
      /^\.nuxt$/,
      /^\.vscode$/,
      /^\.idea$/
    ]
    
    return ignorePatterns.some(pattern => pattern.test(name))
  }
  
  private isRelevantFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    const relevantExtensions = [
      '.ts', '.tsx', '.js', '.jsx',
      '.py', '.java', '.cpp', '.c',
      '.html', '.css', '.scss',
      '.json', '.yaml', '.yml',
      '.md', '.txt', '.env',
      '.sql', '.graphql',
      '.vue', '.svelte'
    ]
    
    const fileName = path.basename(filePath).toLowerCase()
    const relevantFiles = [
      'package.json',
      'tsconfig.json',
      'webpack.config.js',
      'vite.config.ts',
      'readme.md',
      'dockerfile',
      'docker-compose.yml'
    ]
    
    return relevantExtensions.includes(ext) || relevantFiles.includes(fileName)
  }
  
  private async getFileContext(filePath: string): Promise<FileContext | null> {
    try {
      // Check cache first
      const cached = this.fileCache.get(filePath)
      const stats = await fs.stat(filePath)
      
      if (cached && cached.lastModified >= stats.mtime.getTime()) {
        return cached
      }
      
      // Read file content (with size limit)
      const maxSize = 100 * 1024 // 100KB limit
      if (stats.size > maxSize) {
        return null // Skip large files
      }
      
      const content = await fs.readFile(filePath, 'utf-8')
      
      const context: FileContext = {
        path: path.relative(this.workspacePath, filePath),
        content,
        size: stats.size,
        lastModified: stats.mtime.getTime(),
        type: 'file'
      }
      
      // Cache the result
      this.fileCache.set(filePath, context)
      
      return context
    } catch (error) {
      return null
    }
  }
  
  private async getProjectStructure(): Promise<any> {
    try {
      const structure = await this.buildDirectoryTree(this.workspacePath, 3)
      return structure
    } catch (error) {
      return null
    }
  }
  
  private async buildDirectoryTree(dir: string, maxDepth: number, currentDepth = 0): Promise<any> {
    if (currentDepth >= maxDepth) {
      return null
    }
    
    const tree: any = {
      name: path.basename(dir),
      type: 'directory',
      children: []
    }
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        if (this.shouldIgnore(entry.name)) {
          continue
        }
        
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory()) {
          const subTree = await this.buildDirectoryTree(fullPath, maxDepth, currentDepth + 1)
          if (subTree) {
            tree.children.push(subTree)
          }
        } else {
          tree.children.push({
            name: entry.name,
            type: 'file',
            size: (await fs.stat(fullPath)).size
          })
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
    
    return tree
  }
  
  private async getPackageInfo(): Promise<any> {
    try {
      const packagePath = path.join(this.workspacePath, 'package.json')
      const content = await fs.readFile(packagePath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      return null
    }
  }
  
  private async getGitInfo(): Promise<any> {
    try {
      const gitPath = path.join(this.workspacePath, '.git')
      const stats = await fs.stat(gitPath)
      
      if (stats.isDirectory()) {
        // Try to get current branch
        const headPath = path.join(gitPath, 'HEAD')
        const headContent = await fs.readFile(headPath, 'utf-8')
        const branch = headContent.includes('ref: refs/heads/') 
          ? headContent.replace('ref: refs/heads/', '').trim()
          : 'detached'
        
        return {
          isGitRepo: true,
          currentBranch: branch
        }
      }
    } catch (error) {
      // Not a git repo or can't read git info
    }
    
    return { isGitRepo: false }
  }
  
  public async watchFile(filePath: string): Promise<void> {
    if (this.watchedFiles.has(filePath)) {
      return
    }
    
    this.watchedFiles.add(filePath)
    
    try {
      // In a real implementation, you'd use fs.watch or chokidar
      // For now, we'll just mark it as watched
      this.emit('file_watched', filePath)
    } catch (error) {
      this.watchedFiles.delete(filePath)
      throw error
    }
  }
  
  public async unwatchFile(filePath: string): Promise<void> {
    if (this.watchedFiles.has(filePath)) {
      this.watchedFiles.delete(filePath)
      this.emit('file_unwatched', filePath)
    }
  }
  
  public clearCache(): void {
    this.fileCache.clear()
    this.emit('cache_cleared')
  }
  
  public getCacheStats(): { size: number; files: string[] } {
    return {
      size: this.fileCache.size,
      files: Array.from(this.fileCache.keys())
    }
  }
  
  public dispose(): void {
    this.removeAllListeners()
    this.fileCache.clear()
    this.watchedFiles.clear()
  }
}