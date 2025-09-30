import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import bcrypt from 'bcrypt';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
  api_keys: Record<string, string>;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  files: Record<string, string>;
  preview_html: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
}

export interface CodeSession {
  id: string;
  user_id: string;
  project_id: string;
  messages: any[];
  active_file: string;
  created_at: string;
}

export class DatabaseManager {
  private db: Database | null = null;

  async initialize() {
    const fs = require('fs');
    const path = require('path');
    
    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    this.db = await open({
      filename: path.join(dataDir, 'mominai.db'),
      driver: sqlite3.Database
    });

    await this.createTables();
  }

  private async createTables() {
    if (!this.db) return;

    // Users table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        api_keys TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Projects table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        files TEXT DEFAULT '{}',
        preview_html TEXT DEFAULT '',
        is_public BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Code sessions table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS code_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT,
        messages TEXT DEFAULT '[]',
        active_file TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (project_id) REFERENCES projects (id)
      )
    `);

    // Analytics table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS analytics (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        event_type TEXT NOT NULL,
        event_data TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // User operations
  async createUser(email: string, password: string): Promise<User> {
    if (!this.db) throw new Error('Database not initialized');
    
    const id = crypto.randomUUID();
    const password_hash = await bcrypt.hash(password, 10);
    
    await this.db.run(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
      [id, email, password_hash]
    );

    return this.getUserById(id);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    if (!this.db) return null;
    
    const row = await this.db.get(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (!row) return null;

    return {
      ...row,
      api_keys: JSON.parse(row.api_keys || '{}')
    };
  }

  async getUserById(id: string): Promise<User> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await this.db.get(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    if (!row) throw new Error('User not found');

    return {
      ...row,
      api_keys: JSON.parse(row.api_keys || '{}')
    };
  }

  async updateUserApiKeys(userId: string, apiKeys: Record<string, string>): Promise<void> {
    if (!this.db) return;
    
    await this.db.run(
      'UPDATE users SET api_keys = ? WHERE id = ?',
      [JSON.stringify(apiKeys), userId]
    );
  }

  // Project operations
  async createProject(userId: string, name: string): Promise<Project> {
    if (!this.db) throw new Error('Database not initialized');
    
    const id = crypto.randomUUID();
    
    await this.db.run(
      'INSERT INTO projects (id, user_id, name) VALUES (?, ?, ?)',
      [id, userId, name]
    );

    return this.getProject(id);
  }

  async getProject(id: string): Promise<Project> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await this.db.get(
      'SELECT * FROM projects WHERE id = ?',
      [id]
    );

    if (!row) throw new Error('Project not found');

    return {
      ...row,
      files: JSON.parse(row.files || '{}')
    };
  }

  async getUserProjects(userId: string): Promise<Project[]> {
    if (!this.db) return [];
    
    const rows = await this.db.all(
      'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    );

    return rows.map(row => ({
      ...row,
      files: JSON.parse(row.files || '{}')
    }));
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<void> {
    if (!this.db) return;
    
    const fields = [];
    const values = [];
    
    if (updates.name) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    
    if (updates.files) {
      fields.push('files = ?');
      values.push(JSON.stringify(updates.files));
    }
    
    if (updates.preview_html !== undefined) {
      fields.push('preview_html = ?');
      values.push(updates.preview_html);
    }
    
    if (updates.is_public !== undefined) {
      fields.push('is_public = ?');
      values.push(updates.is_public);
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    await this.db.run(
      `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  async deleteProject(id: string): Promise<void> {
    if (!this.db) return;
    
    await this.db.run('DELETE FROM projects WHERE id = ?', [id]);
  }

  // Session operations
  async createSession(userId: string, projectId?: string): Promise<CodeSession> {
    if (!this.db) throw new Error('Database not initialized');
    
    const id = crypto.randomUUID();
    
    await this.db.run(
      'INSERT INTO code_sessions (id, user_id, project_id) VALUES (?, ?, ?)',
      [id, userId, projectId || null]
    );

    return this.getSession(id);
  }

  async getSession(id: string): Promise<CodeSession> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await this.db.get(
      'SELECT * FROM code_sessions WHERE id = ?',
      [id]
    );

    if (!row) throw new Error('Session not found');

    return {
      ...row,
      messages: JSON.parse(row.messages || '[]')
    };
  }

  async updateSession(id: string, updates: Partial<CodeSession>): Promise<void> {
    if (!this.db) return;
    
    const fields = [];
    const values = [];
    
    if (updates.messages) {
      fields.push('messages = ?');
      values.push(JSON.stringify(updates.messages));
    }
    
    if (updates.active_file !== undefined) {
      fields.push('active_file = ?');
      values.push(updates.active_file);
    }
    
    values.push(id);
    
    if (fields.length > 0) {
      await this.db.run(
        `UPDATE code_sessions SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    }
  }

  // Analytics
  async logEvent(userId: string | null, eventType: string, eventData: any): Promise<void> {
    if (!this.db) return;
    const id = crypto.randomUUID();
    await this.db.run(
      'INSERT INTO analytics (id, user_id, event_type, event_data) VALUES (?, ?, ?, ?)',
      [id, userId, eventType, JSON.stringify(eventData)]
    );
  }

  // Stub for public projects
  async getPublicProjects(limit: number, offset: number) {
    return [];
  }
}