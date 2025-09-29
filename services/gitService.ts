import type { Files } from '../types';

export interface GitStatus {
  branch: string;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

export interface DiffInfo {
  file: string;
  additions: number;
  deletions: number;
  changes: DiffChange[];
}

export interface DiffChange {
  type: 'add' | 'remove' | 'modify';
  lineNumber: number;
  content: string;
}

export class GitService {
  private isGitRepo = false;
  private currentBranch = 'main';
  private commits: CommitInfo[] = [];
  private staged: Set<string> = new Set();
  private modified: Set<string> = new Set();

  async initialize(projectPath: string): Promise<boolean> {
    try {
      // Check if git is available and if we're in a git repo
      const result = await this.executeGitCommand('rev-parse --is-inside-work-tree');
      this.isGitRepo = result.trim() === 'true';
      
      if (this.isGitRepo) {
        await this.updateStatus();
      }
      
      return this.isGitRepo;
    } catch (error) {
      console.log('Git not available or not a git repository');
      return false;
    }
  }

  async getStatus(): Promise<GitStatus> {
    if (!this.isGitRepo) {
      return {
        branch: 'main',
        modified: [],
        added: [],
        deleted: [],
        untracked: [],
        ahead: 0,
        behind: 0
      };
    }

    try {
      const [branchInfo, statusOutput] = await Promise.all([
        this.executeGitCommand('branch --show-current'),
        this.executeGitCommand('status --porcelain')
      ]);

      this.currentBranch = branchInfo.trim() || 'main';
      
      const modified: string[] = [];
      const added: string[] = [];
      const deleted: string[] = [];
      const untracked: string[] = [];

      statusOutput.split('\n').forEach(line => {
        if (!line.trim()) return;
        
        const status = line.substring(0, 2);
        const file = line.substring(3);
        
        if (status.includes('M')) modified.push(file);
        if (status.includes('A')) added.push(file);
        if (status.includes('D')) deleted.push(file);
        if (status.includes('??')) untracked.push(file);
      });

      return {
        branch: this.currentBranch,
        modified,
        added,
        deleted,
        untracked,
        ahead: 0, // Would need to parse git status -b for this
        behind: 0
      };
    } catch (error) {
      console.error('Error getting git status:', error);
      throw error;
    }
  }

  async commit(message: string, files?: string[]): Promise<string> {
    if (!this.isGitRepo) {
      throw new Error('Not a git repository');
    }

    try {
      // Stage files if specified, otherwise stage all
      if (files && files.length > 0) {
        await this.executeGitCommand(`add ${files.join(' ')}`);
      } else {
        await this.executeGitCommand('add .');
      }

      // Commit with message
      const result = await this.executeGitCommand(`commit -m "${message}"`);
      
      // Get the commit hash
      const hash = await this.executeGitCommand('rev-parse HEAD');
      
      await this.updateStatus();
      return hash.trim();
    } catch (error) {
      console.error('Error committing:', error);
      throw error;
    }
  }

  async getCommitHistory(limit = 10): Promise<CommitInfo[]> {
    if (!this.isGitRepo) return [];

    try {
      const output = await this.executeGitCommand(
        `log --oneline --format="%H|%s|%an|%ad" --date=short -${limit}`
      );

      return output.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [hash, message, author, date] = line.split('|');
          return {
            hash: hash.substring(0, 8),
            message,
            author,
            date,
            files: [] // Would need separate call to get files
          };
        });
    } catch (error) {
      console.error('Error getting commit history:', error);
      return [];
    }
  }

  async getDiff(file?: string): Promise<DiffInfo[]> {
    if (!this.isGitRepo) return [];

    try {
      const command = file ? `diff ${file}` : 'diff';
      const output = await this.executeGitCommand(command);
      
      return this.parseDiff(output);
    } catch (error) {
      console.error('Error getting diff:', error);
      return [];
    }
  }

  async createBranch(name: string): Promise<void> {
    if (!this.isGitRepo) {
      throw new Error('Not a git repository');
    }

    try {
      await this.executeGitCommand(`checkout -b ${name}`);
      this.currentBranch = name;
    } catch (error) {
      console.error('Error creating branch:', error);
      throw error;
    }
  }

  async switchBranch(name: string): Promise<void> {
    if (!this.isGitRepo) {
      throw new Error('Not a git repository');
    }

    try {
      await this.executeGitCommand(`checkout ${name}`);
      this.currentBranch = name;
    } catch (error) {
      console.error('Error switching branch:', error);
      throw error;
    }
  }

  async getBranches(): Promise<string[]> {
    if (!this.isGitRepo) return ['main'];

    try {
      const output = await this.executeGitCommand('branch');
      return output.split('\n')
        .map(line => line.replace('*', '').trim())
        .filter(line => line);
    } catch (error) {
      console.error('Error getting branches:', error);
      return ['main'];
    }
  }

  generateCommitMessage(files: Files, changedFiles: string[]): string {
    const analysis = this.analyzeChanges(files, changedFiles);
    
    if (analysis.isNewFeature) {
      return `feat: ${analysis.description}`;
    } else if (analysis.isBugFix) {
      return `fix: ${analysis.description}`;
    } else if (analysis.isRefactor) {
      return `refactor: ${analysis.description}`;
    } else if (analysis.isStyleChange) {
      return `style: ${analysis.description}`;
    } else {
      return `update: ${analysis.description}`;
    }
  }

  private analyzeChanges(files: Files, changedFiles: string[]): {
    isNewFeature: boolean;
    isBugFix: boolean;
    isRefactor: boolean;
    isStyleChange: boolean;
    description: string;
  } {
    const newFiles = changedFiles.filter(file => !files[file]);
    const modifiedFiles = changedFiles.filter(file => files[file]);
    
    let description = '';
    let isNewFeature = false;
    let isBugFix = false;
    let isRefactor = false;
    let isStyleChange = false;

    if (newFiles.length > 0) {
      isNewFeature = true;
      description = `add ${newFiles.length} new file${newFiles.length > 1 ? 's' : ''}`;
    } else if (modifiedFiles.some(file => file.includes('test') || file.includes('spec'))) {
      description = 'update tests';
    } else if (modifiedFiles.some(file => file.includes('.css') || file.includes('.scss'))) {
      isStyleChange = true;
      description = 'update styles';
    } else if (modifiedFiles.length === 1) {
      description = `update ${modifiedFiles[0]}`;
    } else {
      description = `update ${modifiedFiles.length} files`;
    }

    return {
      isNewFeature,
      isBugFix,
      isRefactor,
      isStyleChange,
      description
    };
  }

  private parseDiff(diffOutput: string): DiffInfo[] {
    const diffs: DiffInfo[] = [];
    const files = diffOutput.split('diff --git');
    
    files.forEach(fileSection => {
      if (!fileSection.trim()) return;
      
      const lines = fileSection.split('\n');
      const fileLine = lines.find(line => line.startsWith('+++'));
      if (!fileLine) return;
      
      const fileName = fileLine.replace('+++ b/', '');
      const changes: DiffChange[] = [];
      let additions = 0;
      let deletions = 0;
      let lineNumber = 0;
      
      lines.forEach(line => {
        if (line.startsWith('@@')) {
          const match = line.match(/@@ -\d+,?\d* \+(\d+),?\d* @@/);
          if (match) {
            lineNumber = parseInt(match[1]);
          }
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
          changes.push({
            type: 'add',
            lineNumber: lineNumber++,
            content: line.substring(1)
          });
          additions++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          changes.push({
            type: 'remove',
            lineNumber: lineNumber,
            content: line.substring(1)
          });
          deletions++;
        } else if (!line.startsWith('\\')) {
          lineNumber++;
        }
      });
      
      diffs.push({
        file: fileName,
        additions,
        deletions,
        changes
      });
    });
    
    return diffs;
  }

  private async updateStatus(): Promise<void> {
    try {
      const status = await this.getStatus();
      this.modified = new Set([...status.modified, ...status.added, ...status.deleted]);
    } catch (error) {
      console.error('Error updating git status:', error);
    }
  }

  private async executeGitCommand(command: string): Promise<string> {
    // In a real implementation, this would execute git commands
    // For now, we'll simulate git operations
    console.log(`Executing: git ${command}`);
    
    // Simulate different git commands
    if (command === 'rev-parse --is-inside-work-tree') {
      return 'true';
    } else if (command === 'branch --show-current') {
      return this.currentBranch;
    } else if (command === 'status --porcelain') {
      return ''; // No changes
    }
    
    return '';
  }
}

export const gitService = new GitService();