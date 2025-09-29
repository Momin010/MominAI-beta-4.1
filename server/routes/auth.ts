import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { db } from '../index';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mominai-secret-key';

// Register
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user
    const user = await db.createUser(email, password);
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Log registration
    await db.logEvent(user.id, 'user_registered', { email });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Get user
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Log login
    await db.logEvent(user.id, 'user_login', { email });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        api_keys: user.api_keys
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await db.getUserById(decoded.userId);
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        api_keys: user.api_keys
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  const { token } = req.body;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await db.getUserById(decoded.userId);

    const newToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Guest session (temporary user)
router.post('/guest', async (req, res) => {
  try {
    const guestId = `guest_${crypto.randomUUID()}`;
    
    const token = jwt.sign(
      { userId: guestId, email: null, isGuest: true },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log guest session
    await db.logEvent(guestId, 'guest_session_created', {});

    res.json({
      token,
      user: {
        id: guestId,
        email: null,
        isGuest: true,
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export { router as authRouter };