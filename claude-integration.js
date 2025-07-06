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
        this.emit('sessionChanged', { id: this.sessionId });
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
    // The Claude Code SDK query function only works when running in a Claude Code context
    // For now, we'll assume we're not in that context unless we can prove otherwise
    try {
      // Try a simple test - this will likely fail if not in Claude context
      const response = await query('test connection', { 
        cwd: process.cwd(),
        timeout: 2000 
      });
      return true; // If we get here, we're in Claude context
    } catch (error) {
      // Expected when not running under Claude Code
      return false;
    }
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

  disconnect() {
    this.isConnected = false;
    this.currentSession = null;
    this.sessionId = null;
    this.activeFiles.clear();
    this.contextFiles.clear();
    this.currentActivity = 'Disconnected';
    this.emit('connectionChanged', { connected: false });
    this.emit('activityChanged', this.currentActivity);
  }
}

module.exports = ClaudeCodeIntegration;