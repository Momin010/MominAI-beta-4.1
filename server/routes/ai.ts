import { Router, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { AIOrchestrator } from '../../services/aiOrchestrator';
import { wsManager, db } from '../index';

const router = Router();
const aiOrchestrator = new AIOrchestrator();

// Handle preflight OPTIONS request for /api/ai/stream
router.options('/stream', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

// No need for manual CORS preflight handler; global middleware handles it

// Stream AI response
router.post('/stream', async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  const { messages, files, taskType, sessionId } = req.body;
  const userId = req.user.id;


  try {
    // Set up Server-Sent Events without overwriting CORS headers
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullResponse = '';

    const response = await aiOrchestrator.sendRequest({
      messages,
      files,
      taskType,
      onChunk: (chunk: string) => {
        fullResponse += chunk;
        // Send chunk via SSE
        res.write(`data: ${JSON.stringify({ type: 'chunk', data: chunk })}\n\n`);
        // Also broadcast via WebSocket if session exists
        if (sessionId) {
          wsManager.broadcastToSession(sessionId, {
            type: 'ai_stream',
            data: { chunk, userId }
          });
        }
      }
    });

    // Send final response
    res.write(`data: ${JSON.stringify({ type: 'complete', data: response })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();

    // Log the interaction
    await db.logEvent(userId, 'ai_request', {
      taskType,
      messageCount: messages.length,
      hasFiles: !!files
    });

  } catch (error: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`);
    res.end();
  }
});

// Get AI models status
router.get('/models', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const models = aiOrchestrator.getAvailableModels();
    const modelsWithStatus = await Promise.all(
      models.map(async (model) => {
        const isHealthy = await aiOrchestrator.checkModelHealth(model.name);
        return {
          ...model,
          status: isHealthy ? 'healthy' : 'unhealthy',
          lastChecked: new Date().toISOString()
        };
      })
    );

    res.json({ models: modelsWithStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user's API keys
router.post('/keys', async (req: AuthenticatedRequest, res: Response) => {
  const { apiKeys } = req.body;
  const userId = req.user.id;

  try {
    // Validate API keys
    const validatedKeys: Record<string, string> = {};
    
    for (const [provider, key] of Object.entries(apiKeys)) {
      if (typeof key === 'string' && key.trim()) {
        const isValid = await aiOrchestrator.validateApiKey(provider, key);
        if (isValid) {
          validatedKeys[provider] = key;
        }
      }
    }

    await db.updateUserApiKeys(userId, validatedKeys);
    aiOrchestrator.updateUserKeys(userId, validatedKeys);

    res.json({ 
      success: true, 
      validatedProviders: Object.keys(validatedKeys)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get code suggestions
router.post('/suggest', async (req: AuthenticatedRequest, res: Response) => {
  const { code, cursorPosition, filePath, projectFiles } = req.body;
  const userId = req.user.id;

  try {
    const suggestions = await aiOrchestrator.getCodeSuggestions({
      code,
      cursorPosition,
      filePath,
      projectFiles,
      userId
    });

    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze code quality
router.post('/analyze', async (req: AuthenticatedRequest, res: Response) => {
  const { files, focusFile } = req.body;
  const userId = req.user.id;

  try {
    const analysis = await aiOrchestrator.analyzeCode({
      files,
      focusFile,
      userId
    });

    res.json({ analysis });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate commit message
router.post('/commit-message', async (req: AuthenticatedRequest, res: Response) => {
  const { diff, files } = req.body;
  const userId = req.user.id;

  try {
    const message = await aiOrchestrator.generateCommitMessage({
      diff,
      files,
      userId
    });

    res.json({ message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export { router as aiRouter };