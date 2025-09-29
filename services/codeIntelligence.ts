import type { Files } from '../types';

export interface CodeContext {
  filePath: string;
  content: string;
  cursorPosition: number;
  selectedText?: string;
}

export interface Suggestion {
  text: string;
  type: 'completion' | 'fix' | 'optimization' | 'import';
  confidence: number;
  range?: { start: number; end: number };
}

export interface ProjectAnalysis {
  dependencies: string[];
  frameworks: string[];
  architecture: string;
  issues: CodeIssue[];
  suggestions: string[];
}

export interface CodeIssue {
  file: string;
  line: number;
  type: 'error' | 'warning' | 'info';
  message: string;
  fix?: string;
}

export interface Reference {
  file: string;
  line: number;
  column: number;
  context: string;
}

export class CodeIntelligence {
  private projectFiles: Files = {};
  private dependencies: Set<string> = new Set();
  private imports: Map<string, string[]> = new Map();

  updateProject(files: Files) {
    this.projectFiles = files;
    this.analyzeProject();
  }

  private analyzeProject() {
    this.dependencies.clear();
    this.imports.clear();

    Object.entries(this.projectFiles).forEach(([filePath, content]) => {
      this.analyzeFile(filePath, content);
    });
  }

  private analyzeFile(filePath: string, content: string) {
    // Extract imports
    const importRegex = /import\s+(?:{[^}]+}|\w+|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      imports.push(importPath);
      
      // Track external dependencies
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        this.dependencies.add(importPath.split('/')[0]);
      }
    }

    this.imports.set(filePath, imports);
  }

  analyzeProjectStructure(): ProjectAnalysis {
    const frameworks = this.detectFrameworks();
    const architecture = this.detectArchitecture();
    const issues = this.findIssues();
    const suggestions = this.generateSuggestions();

    return {
      dependencies: Array.from(this.dependencies),
      frameworks,
      architecture,
      issues,
      suggestions
    };
  }

  private detectFrameworks(): string[] {
    const frameworks: string[] = [];
    
    if (this.dependencies.has('react')) frameworks.push('React');
    if (this.dependencies.has('vue')) frameworks.push('Vue');
    if (this.dependencies.has('angular')) frameworks.push('Angular');
    if (this.dependencies.has('svelte')) frameworks.push('Svelte');
    if (this.dependencies.has('next')) frameworks.push('Next.js');
    if (this.dependencies.has('nuxt')) frameworks.push('Nuxt.js');
    if (this.dependencies.has('express')) frameworks.push('Express');
    if (this.dependencies.has('fastify')) frameworks.push('Fastify');
    if (this.dependencies.has('tailwindcss')) frameworks.push('Tailwind CSS');

    return frameworks;
  }

  private detectArchitecture(): string {
    const hasComponents = Object.keys(this.projectFiles).some(path => 
      path.includes('components') || path.includes('Components')
    );
    const hasPages = Object.keys(this.projectFiles).some(path => 
      path.includes('pages') || path.includes('Pages')
    );
    const hasServices = Object.keys(this.projectFiles).some(path => 
      path.includes('services') || path.includes('api')
    );

    if (hasComponents && hasPages && hasServices) return 'Layered Architecture';
    if (hasComponents && hasPages) return 'Component-Based Architecture';
    if (hasServices) return 'Service-Oriented Architecture';
    return 'Monolithic Architecture';
  }

  private findIssues(): CodeIssue[] {
    const issues: CodeIssue[] = [];

    Object.entries(this.projectFiles).forEach(([filePath, content]) => {
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for common issues
        if (line.includes('console.log') && !line.includes('//')) {
          issues.push({
            file: filePath,
            line: index + 1,
            type: 'warning',
            message: 'Console.log statement found - consider removing for production',
            fix: 'Remove or replace with proper logging'
          });
        }

        if (line.includes('any') && filePath.endsWith('.ts')) {
          issues.push({
            file: filePath,
            line: index + 1,
            type: 'warning',
            message: 'Using "any" type reduces type safety',
            fix: 'Use specific types instead of "any"'
          });
        }

        if (line.includes('==') && !line.includes('===')) {
          issues.push({
            file: filePath,
            line: index + 1,
            type: 'info',
            message: 'Consider using strict equality (===) instead of loose equality (==)',
            fix: 'Replace == with ==='
          });
        }
      });
    });

    return issues;
  }

  private generateSuggestions(): string[] {
    const suggestions: string[] = [];

    // Performance suggestions
    if (this.dependencies.has('react') && !this.dependencies.has('react-memo')) {
      suggestions.push('Consider using React.memo for performance optimization');
    }

    // Security suggestions
    if (!this.projectFiles['package.json']?.includes('"private": true')) {
      suggestions.push('Mark package.json as private to prevent accidental publishing');
    }

    // Architecture suggestions
    if (Object.keys(this.projectFiles).length > 10 && !Object.keys(this.projectFiles).some(p => p.includes('components'))) {
      suggestions.push('Consider organizing code into components for better maintainability');
    }

    return suggestions;
  }

  getCompletions(context: CodeContext): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const { content, cursorPosition } = context;
    
    const beforeCursor = content.substring(0, cursorPosition);
    const afterCursor = content.substring(cursorPosition);
    const currentLine = beforeCursor.split('\n').pop() || '';

    // Import suggestions
    if (currentLine.trim().startsWith('import')) {
      suggestions.push(...this.getImportSuggestions(currentLine));
    }

    // Function suggestions
    if (currentLine.includes('function ') || currentLine.includes('const ') && currentLine.includes('=')) {
      suggestions.push(...this.getFunctionSuggestions(context));
    }

    // React component suggestions
    if (this.dependencies.has('react') && currentLine.includes('<')) {
      suggestions.push(...this.getReactSuggestions(currentLine));
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private getImportSuggestions(line: string): Suggestion[] {
    const suggestions: Suggestion[] = [];
    
    // Common React imports
    if (this.dependencies.has('react')) {
      suggestions.push({
        text: "import React, { useState, useEffect } from 'react';",
        type: 'import',
        confidence: 0.9
      });
    }

    return suggestions;
  }

  private getFunctionSuggestions(context: CodeContext): Suggestion[] {
    const suggestions: Suggestion[] = [];
    
    // Async function pattern
    suggestions.push({
      text: 'async (params) => {\n  try {\n    // Implementation\n  } catch (error) {\n    console.error(error);\n  }\n}',
      type: 'completion',
      confidence: 0.8
    });

    return suggestions;
  }

  private getReactSuggestions(line: string): Suggestion[] {
    const suggestions: Suggestion[] = [];
    
    // Common React patterns
    if (line.includes('<div')) {
      suggestions.push({
        text: '<div className="">\n  \n</div>',
        type: 'completion',
        confidence: 0.7
      });
    }

    return suggestions;
  }

  findReferences(symbol: string): Reference[] {
    const references: Reference[] = [];

    Object.entries(this.projectFiles).forEach(([filePath, content]) => {
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const regex = new RegExp(`\\b${symbol}\\b`, 'g');
        let match;
        
        while ((match = regex.exec(line)) !== null) {
          references.push({
            file: filePath,
            line: index + 1,
            column: match.index + 1,
            context: line.trim()
          });
        }
      });
    });

    return references;
  }

  getFileStructure(): Record<string, string[]> {
    const structure: Record<string, string[]> = {};
    
    Object.entries(this.projectFiles).forEach(([filePath, content]) => {
      const functions: string[] = [];
      const classes: string[] = [];
      const exports: string[] = [];
      
      // Extract functions
      const functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?\()/g;
      let match;
      while ((match = functionRegex.exec(content)) !== null) {
        functions.push(match[1] || match[2]);
      }
      
      // Extract classes
      const classRegex = /class\s+(\w+)/g;
      while ((match = classRegex.exec(content)) !== null) {
        classes.push(match[1]);
      }
      
      // Extract exports
      const exportRegex = /export\s+(?:default\s+)?(?:function\s+(\w+)|class\s+(\w+)|const\s+(\w+))/g;
      while ((match = exportRegex.exec(content)) !== null) {
        exports.push(match[1] || match[2] || match[3]);
      }
      
      structure[filePath] = [...functions, ...classes, ...exports].filter(Boolean);
    });
    
    return structure;
  }
}

export const codeIntelligence = new CodeIntelligence();