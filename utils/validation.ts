// Decode HTML entities to their original characters
export const decodeHtmlEntities = (str: string): string => {
  if (!str) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = str;
  return textarea.value;
};
// Input validation and sanitization utilities
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Sanitize HTML content to prevent XSS
export const sanitizeHtml = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Validate and sanitize project names
export const validateProjectName = (name: string): string => {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Project name is required', 'projectName');
  }
  
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('Project name cannot be empty', 'projectName');
  }
  
  if (trimmed.length > 100) {
    throw new ValidationError('Project name must be less than 100 characters', 'projectName');
  }
  
  // Remove potentially dangerous characters
  return trimmed.replace(/[<>:"/\\|?*\x00-\x1f]/g, '');
};

// Validate file paths
export const validateFilePath = (path: string): string => {
  if (!path || typeof path !== 'string') {
    throw new ValidationError('File path is required', 'filePath');
  }
  
  const trimmed = path.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('File path cannot be empty', 'filePath');
  }
  
  // Prevent directory traversal attacks
  if (trimmed.includes('..') || trimmed.includes('~')) {
    throw new ValidationError('Invalid file path: directory traversal not allowed', 'filePath');
  }
  
  // Validate file extension
  const allowedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.json', '.md', '.txt'];
  const hasValidExtension = allowedExtensions.some(ext => trimmed.toLowerCase().endsWith(ext));
  
  if (!hasValidExtension) {
    throw new ValidationError('File type not allowed', 'filePath');
  }
  
  return trimmed;
};

// Validate file content
export const validateFileContent = (content: string): string => {
  if (typeof content !== 'string') {
    throw new ValidationError('File content must be a string', 'content');
  }
  
  // Limit file size (1MB)
  if (content.length > 1024 * 1024) {
    throw new ValidationError('File content too large (max 1MB)', 'content');
  }
  
  return content;
};

// Validate chat messages
export const validateChatMessage = (message: string): string => {
  if (!message || typeof message !== 'string') {
    throw new ValidationError('Message is required', 'message');
  }
  
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('Message cannot be empty', 'message');
  }
  
  if (trimmed.length > 10000) {
    throw new ValidationError('Message too long (max 10,000 characters)', 'message');
  }
  
  return trimmed;
};

// Validate GitHub token
export const validateGitHubToken = (token: string): string => {
  if (!token || typeof token !== 'string') {
    throw new ValidationError('GitHub token is required', 'token');
  }
  
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('GitHub token cannot be empty', 'token');
  }
  
  // Basic GitHub token format validation
  if (!/^gh[ps]_[A-Za-z0-9_]{36,}$/.test(trimmed)) {
    throw new ValidationError('Invalid GitHub token format', 'token');
  }
  
  return trimmed;
};

// Validate file attachments
export const validateFileAttachment = (file: File): void => {
  if (!file) {
    throw new ValidationError('File is required', 'file');
  }
  
  // Check file size (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    throw new ValidationError('File size too large (max 5MB)', 'file');
  }
  
  // Check file type
  if (!file.type.startsWith('image/')) {
    throw new ValidationError('Only image files are allowed', 'file');
  }
  
  // Check for allowed image types
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new ValidationError('Image type not supported', 'file');
  }
};

// Sanitize API responses
export const sanitizeApiResponse = (response: any): any => {
  if (typeof response === 'string') {
    return sanitizeHtml(response);
  }
  
  if (Array.isArray(response)) {
    return response.map(sanitizeApiResponse);
  }
  
  if (response && typeof response === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(response)) {
      sanitized[key] = sanitizeApiResponse(value);
    }
    return sanitized;
  }
  
  return response;
};