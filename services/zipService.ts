import JSZip from 'jszip';
import type { Files } from '../types';
import { ValidationError, validateProjectName, validateFileContent } from '../utils/validation';

/**
 * Creates a ZIP file from the project files and triggers a download.
 * @param files - A map of file paths to their content.
 * @param projectName - The name of the project, used for the zip file name.
 */
export const downloadProjectAsZip = async (files: Files, projectName: string): Promise<void> => {
  try {
    // Input validation
    if (!files || typeof files !== 'object') {
      throw new ValidationError('Files object is required');
    }
    
    if (Object.keys(files).length === 0) {
      throw new ValidationError('Cannot create ZIP: no files provided');
    }
    
    const validatedProjectName = validateProjectName(projectName);
    
    // Validate each file
    const validatedFiles: Files = {};
    Object.entries(files).forEach(([path, content]) => {
      if (!path || typeof path !== 'string') {
        throw new ValidationError('Invalid file path detected');
      }
      
      const validatedContent = validateFileContent(content);
      
      // Additional path validation for ZIP
      const sanitizedPath = path.replace(/\.\./g, '').replace(/^\/+/, '');
      if (sanitizedPath !== path) {
        console.warn(`File path sanitized: ${path} -> ${sanitizedPath}`);
      }
      
      validatedFiles[sanitizedPath] = validatedContent;
    });
    
    const zip = new JSZip();

    // Add all validated files to the zip archive
    Object.entries(validatedFiles).forEach(([path, content]) => {
      try {
        zip.file(path, content);
      } catch (error) {
        console.error(`Failed to add file to ZIP: ${path}`, error);
        throw new Error(`Failed to add file to ZIP: ${path}`);
      }
    });

    // Generate the zip file as a blob with error handling
    let zipBlob: Blob;
    try {
      zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
    } catch (error) {
      console.error('Failed to generate ZIP blob:', error);
      throw new Error('Failed to generate ZIP file');
    }
    
    if (!zipBlob || zipBlob.size === 0) {
      throw new Error('Generated ZIP file is empty or invalid');
    }

    // Sanitize the project name for use as a filename
    const safeProjectName = validatedProjectName
      .replace(/[^a-z0-9_-]/gi, '_')
      .toLowerCase() || 'project';

    // Create a temporary link to trigger the download
    const link = document.createElement('a');
    
    try {
      const objectUrl = URL.createObjectURL(zipBlob);
      link.href = objectUrl;
      link.download = `${safeProjectName}.zip`;
      
      // Ensure the link is properly configured
      link.style.display = 'none';
      
      // Append to body, click, and then remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the object URL after a short delay
      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);
      
    } catch (error) {
      console.error('Failed to create download link:', error);
      throw new Error('Failed to initiate download');
    }

  } catch (error) {
    console.error('Failed to create or download project ZIP:', error);
    
    let errorMessage = 'Sorry, there was an error creating the download file.';
    
    if (error instanceof ValidationError) {
      errorMessage = `Validation error: ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = `Download error: ${error.message}`;
    }
    
    // Show user-friendly error message
    alert(errorMessage);
    throw error; // Re-throw for calling code to handle if needed
  }
};