
import React, { useState, useMemo } from 'react';
import type { Files } from '../types';
import { Icon } from './Icon';

// Define the structure for our file tree
interface FileNode {
  type: 'file';
  name: string;
  path: string;
}

interface FolderNode {
  type: 'folder';
  name: string;
  path: string;
  children: TreeNode[];
}

type TreeNode = FileNode | FolderNode;

/**
 * Builds a hierarchical tree structure from a flat list of file paths.
 * @param files - The flat file map from the application state.
 * @returns An array of root-level nodes (files and folders).
 */
const buildFileTree = (files: Files): TreeNode[] => {
  const root: { children: { [key: string]: any } } = { children: {} };

  // Create a nested object structure based on paths
  Object.keys(files).forEach(path => {
    let currentLevel = root.children;
    const parts = path.split('/');
    
    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const currentPath = parts.slice(0, index + 1).join('/');

      if (isFile) {
        currentLevel[part] = { type: 'file', name: part, path: path };
      } else {
        if (!currentLevel[part]) {
          currentLevel[part] = { type: 'folder', name: part, path: currentPath, children: {} };
        }
        currentLevel = currentLevel[part].children;
      }
    });
  });

  // Recursively convert the object structure to a sorted array
  const convertToArray = (nodes: { [key: string]: any }): TreeNode[] => {
    return Object.values(nodes)
      .map(node => {
        if (node.type === 'folder') {
          node.children = convertToArray(node.children);
        }
        return node as TreeNode;
      })
      .sort((a, b) => {
        // Sort folders before files, then alphabetically
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });
  };

  return convertToArray(root.children);
};

/**
 * A recursive component to render a single node (file or folder) in the tree.
 */
const TreeNodeComponent: React.FC<{
  node: TreeNode;
  activeFile: string;
  onSelectFile: (path: string) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
}> = ({ node, activeFile, onSelectFile, expandedFolders, onToggleFolder }) => {
  
  if (node.type === 'folder') {
    const isExpanded = expandedFolders.has(node.path);
    return (
      <li key={node.path}>
        <button
          onClick={() => onToggleFolder(node.path)}
          className="w-full text-left flex items-center p-2 rounded-lg text-sm hover:bg-white/5 text-gray-300 transition-colors"
          aria-expanded={isExpanded}
        >
          <Icon name="chevron-down" className={`w-4 h-4 mr-1 flex-shrink-0 transition-transform ${!isExpanded ? '-rotate-90' : ''}`} />
          <Icon name="folder" className="w-4 h-4 mr-2 flex-shrink-0 text-purple-400" />
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && (
          <ul className="pl-4 border-l border-white/10">
            {node.children.map(child => (
              <TreeNodeComponent
                key={child.path}
                node={child}
                activeFile={activeFile}
                onSelectFile={onSelectFile}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  // It's a file
  return (
    <li key={node.path}>
      <button
        onClick={() => onSelectFile(node.path)}
        className={`w-full text-left flex items-center p-2 pl-3 rounded-lg text-sm transition-colors ${
          activeFile === node.path ? 'bg-purple-600/30 text-purple-300' : 'hover:bg-white/5 text-gray-300'
        }`}
      >
        <Icon name="file" className="w-4 h-4 mr-2 flex-shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  );
};


interface FileExplorerProps {
  files: Files;
  activeFile: string;
  onSelectFile: (path: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ files, activeFile, onSelectFile }) => {
  const fileTree = useMemo(() => buildFileTree(files), [files]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const handleToggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  return (
    <div className="flex flex-col h-full bg-black/10">
       <div className="flex-shrink-0 p-3 border-b border-white/10">
        <h2 className="text-sm font-semibold flex items-center text-gray-300">
          <Icon name="folder" className="w-4 h-4 mr-2" />
          File Explorer
        </h2>
      </div>
      <div className="flex-grow p-2 overflow-y-auto">
        {fileTree.length === 0 ? (
          <p className="text-gray-500 px-2 text-sm">No files generated yet.</p>
        ) : (
          <ul>
            {fileTree.map(node => (
              <TreeNodeComponent
                key={node.path}
                node={node}
                activeFile={activeFile}
                onSelectFile={onSelectFile}
                expandedFolders={expandedFolders}
                onToggleFolder={handleToggleFolder}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FileExplorer;