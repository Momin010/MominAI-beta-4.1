import { Router, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { wsManager, db } from '../index';

const router = Router();

// Get user's projects
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projects = await db.getUserProjects(req.user.id);
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new project
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.body;
  
  try {
    const project = await db.createProject(req.user.id, name);
    
    // Log project creation
    await db.logEvent(req.user.id, 'project_created', { projectId: project.id, name });
    
    res.json({ project });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific project
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const project = await db.getProject(req.params.id);
    
    // Check if user owns the project or if it's public
    if (project.user_id !== req.user.id && !project.is_public) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({ project });
  } catch (error) {
    res.status(404).json({ error: 'Project not found' });
  }
});

// Update project
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { name, files, previewHtml, isPublic } = req.body;
  
  try {
    const project = await db.getProject(req.params.id);
    
    if (project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await db.updateProject(req.params.id, {
      name,
      files,
      preview_html: previewHtml,
      is_public: isPublic
    });
    
    // Broadcast changes to connected clients
    wsManager.broadcastToProject(req.params.id, {
      type: 'code_change',
      data: { files, updatedBy: req.user.id }
    });
    
    // Log project update
    await db.logEvent(req.user.id, 'project_updated', { 
      projectId: req.params.id,
      changes: { name: !!name, files: !!files, previewHtml: !!previewHtml }
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete project
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const project = await db.getProject(req.params.id);
    
    if (project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await db.deleteProject(req.params.id);
    
    // Log project deletion
    await db.logEvent(req.user.id, 'project_deleted', { projectId: req.params.id });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fork project
router.post('/:id/fork', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const originalProject = await db.getProject(req.params.id);
    
    if (!originalProject.is_public && originalProject.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Cannot fork private project' });
    }
    
    const forkedProject = await db.createProject(
      req.user.id, 
      `${originalProject.name} (Fork)`
    );
    
    await db.updateProject(forkedProject.id, {
      files: originalProject.files,
      preview_html: originalProject.preview_html
    });
    
    // Log fork event
    await db.logEvent(req.user.id, 'project_forked', { 
      originalProjectId: req.params.id,
      forkedProjectId: forkedProject.id 
    });
    
    res.json({ project: forkedProject });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Share project (make public/private)
router.post('/:id/share', async (req: AuthenticatedRequest, res: Response) => {
  const { isPublic } = req.body;
  
  try {
    const project = await db.getProject(req.params.id);
    
    if (project.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await db.updateProject(req.params.id, { is_public: isPublic });
    
    // Log sharing event
    await db.logEvent(req.user.id, 'project_shared', { 
      projectId: req.params.id,
      isPublic 
    });
    
    res.json({ success: true, shareUrl: isPublic ? `/share/${req.params.id}` : null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get public projects (discover)
router.get('/public/discover', async (req: AuthenticatedRequest, res: Response) => {
  const { limit = 20, offset = 0 } = req.query;
  
  try {
    // This would need a more sophisticated query in a real implementation
    const projects = await db.getPublicProjects(Number(limit), Number(offset));
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export { router as projectRouter };