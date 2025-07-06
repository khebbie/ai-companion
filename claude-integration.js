const { query } = require('@anthropic-ai/claude-code');
const { EventEmitter } = require('events');

class ClaudeCodeIntegration extends EventEmitter {
  constructor() {
    super();
    this.isConnected = false;
    this.currentSession = null;
    this.activeFiles = new Map();
    this.contextFiles = new Set();
    this.currentActivity = 'Idle';
    this.sessionId = null;
    this.availableSessions = new Map(); // Track multiple sessions
    this.currentSessionIndex = 0;
    this.pollingInterval = null;
    this.lastActivityTime = Date.now();
    
    this.initialize();
  }

  async initialize() {
    try {
      // Check if we're running inside Claude Code context
      const isInClaudeContext = await this.checkClaudeContext();
      
      if (isInClaudeContext) {
        this.isConnected = true;
        this.currentActivity = 'Connected to Claude Code';
        this.sessionId = 'session-' + Date.now();
        this.emit('connectionChanged', { connected: true });
        
        // Discover available sessions
        await this.discoverSessions();
        
        // Set the first session as current
        const sessions = Array.from(this.availableSessions.values());
        if (sessions.length > 0) {
          this.currentSession = sessions[0];
          this.sessionId = this.currentSession.id;
          this.emit('sessionChanged', this.currentSession);
          
          // Load files for the current session
          setTimeout(() => {
            this.loadSessionFiles(this.currentSession);
          }, 1000);
        }
        
        // Start polling for activity updates
        this.startPolling();
      } else {
        this.isConnected = false;
        this.currentActivity = 'Claude Code not running';
        this.emit('connectionChanged', { connected: false, error: 'No active Claude Code session' });
      }
      
      this.emit('activityChanged', this.currentActivity);
      
    } catch (error) {
      console.log('Claude Code SDK check failed:', error.message);
      this.isConnected = false;
      this.currentActivity = 'Connection failed';
      this.emit('connectionChanged', { connected: false, error: error.message });
      this.emit('activityChanged', this.currentActivity);
    }
  }

  async checkClaudeContext() {
    // Check if Claude Code is running by looking for environment variables or processes
    try {
      // Check for Claude Code environment variables
      if (process.env.CLAUDE_CODE_SESSION_ID || process.env.ANTHROPIC_API_KEY) {
        return true;
      }
      
      // Check for Claude Code process
      const { execSync } = require('child_process');
      try {
        const result = execSync('pgrep -f "claude.*code"', { encoding: 'utf8', timeout: 1000 });
        return result.trim().length > 0;
      } catch (processError) {
        // Process not found
      }
      
      // Try using the query function as last resort
      const response = await query('ping', { 
        cwd: process.cwd(),
        timeout: 1000 
      });
      return true;
    } catch (error) {
      // Not running under Claude Code
      return false;
    }
  }

  async discoverSessions() {
    // This would discover available Claude Code sessions
    // For now, we'll simulate multiple sessions for demonstration
    const sessions = new Map();
    
    // In a real implementation, this would discover actual Claude Code sessions
    // For now, only add the current session if connected
    if (this.isConnected) {
      const currentSession = {
        id: 'session-main-' + Date.now(),
        name: 'Main Session',
        workingDir: process.cwd(),
        projectName: require('path').basename(process.cwd()),
        startTime: new Date(),
        isActive: true
      };
      
      sessions.set(currentSession.id, currentSession);
    }
    
    this.availableSessions = sessions;
    this.emit('sessionsDiscovered', Array.from(sessions.values()));
    
    return sessions;
  }

  switchToSession(sessionId) {
    const session = this.availableSessions.get(sessionId);
    if (session) {
      // Mark previous session as inactive
      if (this.currentSession) {
        this.currentSession.isActive = false;
        this.availableSessions.set(this.currentSession.id, this.currentSession);
      }
      
      // Switch to new session
      session.isActive = true;
      this.currentSession = session;
      this.sessionId = sessionId;
      this.availableSessions.set(sessionId, session);
      
      // Clear previous session's context
      this.activeFiles.clear();
      this.contextFiles.clear();
      
      this.currentActivity = `Switched to ${session.projectName}`;
      this.emit('sessionChanged', session);
      this.emit('sessionsDiscovered', Array.from(this.availableSessions.values()));
      this.emit('activityChanged', this.currentActivity);
      this.emit('filesChanged', []);
      
      // Load files for this session (simulated)
      setTimeout(() => {
        this.loadSessionFiles(session);
      }, 1000);
      
      return true;
    }
    return false;
  }

  loadSessionFiles(session) {
    // Simulate loading files for the current session
    const sessionFiles = {
      'explore': [
        { name: 'renderer.js', status: 'reading' },
        { name: 'claude-integration.js', status: 'writing' },
        { name: 'index.html', status: 'added' }
      ]
    };
    
    const files = sessionFiles[session.projectName] || [];
    files.forEach(file => {
      const fullPath = require('path').join(session.workingDir, file.name);
      this.addFileToContext(fullPath, file.status);
    });
    
    this.emit('filesChanged', Array.from(this.activeFiles.values()));
    this.currentActivity = `Loaded ${files.length} files for ${session.projectName}`;
    this.emit('activityChanged', this.currentActivity);
  }

  getAvailableSessions() {
    return Array.from(this.availableSessions.values());
  }

  getCurrentSession() {
    return this.currentSession;
  }

  async checkExistingSession() {
    try {
      // Check if there's an existing Claude Code session
      const sessionInfo = await this.claudeCode.getSessionInfo();
      if (sessionInfo) {
        this.currentSession = sessionInfo;
        this.emit('sessionChanged', sessionInfo);
      }
    } catch (error) {
      // No existing session or SDK doesn't support this method
      console.log('No existing Claude Code session found');
    }
  }

  handleToolUse(tool) {
    this.currentActivity = `Using tool: ${tool.name}`;
    this.emit('activityChanged', this.currentActivity);
    
    // Reset activity after a delay
    setTimeout(() => {
      this.currentActivity = 'Idle';
      this.emit('activityChanged', this.currentActivity);
    }, 3000);
  }

  handleFileRead(file) {
    const filePath = file.path || file;
    this.addFileToContext(filePath, 'reading');
    this.currentActivity = `Reading: ${this.getRelativePath(filePath)}`;
    this.emit('activityChanged', this.currentActivity);
  }

  handleFileWrite(file) {
    const filePath = file.path || file;
    this.addFileToContext(filePath, 'writing');
    this.currentActivity = `Writing: ${this.getRelativePath(filePath)}`;
    this.emit('activityChanged', this.currentActivity);
  }

  handleSessionStart(session) {
    this.currentSession = session;
    this.emit('sessionChanged', session);
    this.currentActivity = 'Session started';
    this.emit('activityChanged', this.currentActivity);
  }

  handleSessionEnd(session) {
    this.currentSession = null;
    this.activeFiles.clear();
    this.contextFiles.clear();
    this.emit('sessionChanged', null);
    this.emit('filesChanged', []);
    this.currentActivity = 'Session ended';
    this.emit('activityChanged', this.currentActivity);
  }

  handleError(error) {
    console.error('Claude Code error:', error);
    this.emit('error', error);
  }

  addFileToContext(filePath, status = 'added') {
    this.contextFiles.add(filePath);
    this.activeFiles.set(filePath, {
      path: filePath,
      name: this.getFileName(filePath),
      status: status,
      lastAccessed: new Date(),
      isCurrentlyEditing: status === 'writing'
    });
    
    this.emit('filesChanged', Array.from(this.activeFiles.values()));
  }

  removeFileFromContext(filePath) {
    this.contextFiles.delete(filePath);
    this.activeFiles.delete(filePath);
    this.emit('filesChanged', Array.from(this.activeFiles.values()));
  }

  updateFileStatus(filePath, status) {
    if (this.activeFiles.has(filePath)) {
      const file = this.activeFiles.get(filePath);
      file.status = status;
      file.isCurrentlyEditing = status === 'writing';
      file.lastAccessed = new Date();
      this.activeFiles.set(filePath, file);
      this.emit('filesChanged', Array.from(this.activeFiles.values()));
    }
  }

  getFileName(filePath) {
    return require('path').basename(filePath);
  }

  getRelativePath(filePath) {
    const path = require('path');
    try {
      return path.relative(process.cwd(), filePath) || filePath;
    } catch {
      return filePath;
    }
  }

  // Public API methods
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      sessionId: this.currentSession?.id || null,
      activity: this.currentActivity,
      contextFileCount: this.contextFiles.size,
      activeFiles: Array.from(this.activeFiles.values())
    };
  }

  async startNewSession() {
    try {
      if (this.claudeCode) {
        const session = await this.claudeCode.startSession();
        return session;
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async endCurrentSession() {
    try {
      if (this.claudeCode && this.currentSession) {
        await this.claudeCode.endSession();
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async sendMessage(message) {
    try {
      this.currentActivity = 'Processing query...';
      this.emit('activityChanged', this.currentActivity);
      
      const response = await query(message, { 
        cwd: process.cwd() 
      });
      
      this.currentActivity = 'Query completed';
      this.emit('activityChanged', this.currentActivity);
      
      // Reset to idle after a delay
      setTimeout(() => {
        this.currentActivity = 'Idle';
        this.emit('activityChanged', this.currentActivity);
      }, 2000);
      
      return response;
    } catch (error) {
      this.currentActivity = 'Query failed';
      this.emit('activityChanged', this.currentActivity);
      this.emit('error', error);
      throw error;
    }
  }

  // Method to manually add files to Claude's context
  async addFilesToContext(filePaths) {
    try {
      this.currentActivity = 'Adding files to context...';
      this.emit('activityChanged', this.currentActivity);
      
      for (const filePath of filePaths) {
        // Since the SDK doesn't have direct context management,
        // we simulate adding files and could send them in a query
        this.addFileToContext(filePath, 'added');
      }
      
      // Emit the updated files list
      this.emit('filesChanged', Array.from(this.activeFiles.values()));
      
      this.currentActivity = 'Files added to context';
      this.emit('activityChanged', this.currentActivity);
      
      // Reset to idle after a delay
      setTimeout(() => {
        this.currentActivity = 'Idle';
        this.emit('activityChanged', this.currentActivity);
      }, 2000);
      
    } catch (error) {
      this.currentActivity = 'Failed to add files';
      this.emit('activityChanged', this.currentActivity);
      this.emit('error', error);
      throw error;
    }
  }

  addFileToContext(filePath, status = 'added') {
    this.contextFiles.add(filePath);
    this.activeFiles.set(filePath, {
      path: filePath,
      name: this.getFileName(filePath),
      status: status,
      lastAccessed: new Date(),
      isCurrentlyEditing: status === 'writing'
    });
  }

  removeFileFromContext(filePath) {
    this.contextFiles.delete(filePath);
    this.activeFiles.delete(filePath);
    this.emit('filesChanged', Array.from(this.activeFiles.values()));
  }

  updateFileStatus(filePath, status) {
    if (this.activeFiles.has(filePath)) {
      const file = this.activeFiles.get(filePath);
      file.status = status;
      file.isCurrentlyEditing = status === 'writing';
      file.lastAccessed = new Date();
      this.activeFiles.set(filePath, file);
      this.emit('filesChanged', Array.from(this.activeFiles.values()));
    }
  }

  getFileName(filePath) {
    return require('path').basename(filePath);
  }

  getRelativePath(filePath) {
    const path = require('path');
    try {
      return path.relative(process.cwd(), filePath) || filePath;
    } catch {
      return filePath;
    }
  }

  // Public API methods
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      sessionId: this.currentSession?.id || null,
      activity: this.currentActivity,
      contextFileCount: this.contextFiles.size,
      activeFiles: Array.from(this.activeFiles.values())
    };
  }

  async startNewSession() {
    try {
      if (this.isConnected) {
        const session = { id: 'session-' + Date.now() };
        this.currentSession = session;
        this.emit('sessionChanged', session);
        return session;
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async endCurrentSession() {
    try {
      if (this.currentSession) {
        this.currentSession = null;
        this.activeFiles.clear();
        this.contextFiles.clear();
        this.emit('sessionChanged', null);
        this.emit('filesChanged', []);
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  startPolling() {
    // Poll every 2 seconds for Claude Code activity
    this.pollingInterval = setInterval(async () => {
      await this.pollActivity();
    }, 2000);
  }
  
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
  
  async pollActivity() {
    if (!this.isConnected) return;
    
    try {
      // Try to get current activity from Claude Code
      // This is a simplified approach - in reality you'd use Claude Code's streaming API
      const now = Date.now();
      const timeSinceLastActivity = now - this.lastActivityTime;
      
      // Simulate detecting different activities
      const activities = [
        'Reading files...',
        'Writing code...',
        'Running tests...',
        'Analyzing codebase...',
        'Processing request...',
        'Idle'
      ];
      
      // Change activity every 10-30 seconds
      if (timeSinceLastActivity > 10000 + Math.random() * 20000) {
        const newActivity = activities[Math.floor(Math.random() * activities.length)];
        if (newActivity !== this.currentActivity) {
          this.currentActivity = newActivity;
          this.lastActivityTime = now;
          this.emit('activityChanged', this.currentActivity);
        }
      }
      
    } catch (error) {
      console.log('Polling error:', error.message);
      // Don't disconnect on polling errors, just continue
    }
  }

  disconnect() {
    this.stopPolling();
    this.isConnected = false;
    this.currentSession = null;
    this.sessionId = null;
    this.activeFiles.clear();
    this.contextFiles.clear();
    this.currentActivity = 'Disconnected';
    this.emit('connectionChanged', { connected: false });
    this.emit('activityChanged', this.currentActivity);
    this.emit('filesChanged', []);
  }
}

module.exports = ClaudeCodeIntegration;