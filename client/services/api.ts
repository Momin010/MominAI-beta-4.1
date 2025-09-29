class APIClient {
  private baseURL: string;
  private token: string | null = null;

  constructor() {
    this.baseURL = process.env.NODE_ENV === 'production'
      ? 'https://api.mominai.com'
      : '';

    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('mominai_token');
    }
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers: headers as HeadersInit,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async login(email: string, password: string) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    this.setToken(data.token);
    return data;
  }

  async register(email: string, password: string) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    this.setToken(data.token);
    return data;
  }

  async createGuestSession() {
    const data = await this.request('/api/auth/guest', {
      method: 'POST',
    });
    
    this.setToken(data.token);
    return data;
  }

  async streamAI(messages: any[], options: any = {}) {
    const response = await fetch(`${this.baseURL}/api/ai/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        messages,
        ...options,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response;
  }

  async getProjects() {
    return this.request('/api/projects');
  }

  async createProject(name: string) {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async updateProject(id: string, updates: any) {
    return this.request(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  createWebSocket(sessionId: string, projectId?: string) {
    const wsURL = this.baseURL.replace('http', 'ws');
    const params = new URLSearchParams({
      userId: this.getCurrentUserId(),
      sessionId,
    });
    
    if (projectId) {
      params.set('projectId', projectId);
    }

    return new WebSocket(`${wsURL}?${params}`);
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('mominai_token', token);
    }
  }

  getCurrentUserId(): string {
    if (!this.token) return '';
    
    try {
      const payload = JSON.parse(atob(this.token.split('.')[1]));
      return payload.userId || '';
    } catch {
      return '';
    }
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }
}

export const apiClient = new APIClient();