const { ClaudeCode } = require('@anthropic-ai/claude-code');
const { EventEmitter } = require('events');

class ClaudeCodeIntegration extends EventEmitter {
  constructor() {
    super();
    this.claudeCode = null;
    this.isConnected = false;
    this.currentSession = null;
    this.activeFiles = new Map();
    this.contextFiles = new Set();
    this.currentActivity = 'Idle';
    
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize Claude Code SDK
      this.claudeCode = new ClaudeCode({
        // Configuration options
        cwd: process.cwd(),
        // Event handlers for monitoring Claude's activity
        onToolUse: (tool) => this.handleToolUse(tool),
        onFileRead: (file) => this.handleFileRead(file),
        onFileWrite: (file) => this.handleFileWrite(file),
        onSessionStart: (session) => this.handleSessionStart(session),
        onSessionEnd: (session) => this.handleSessionEnd(session),
        onError: (error) => this.handleError(error)
      });
      
      this.isConnected = true;
      this.emit('connectionChanged', { connected: true });
      
      // Check for existing session
      await this.checkExistingSession();
      
    } catch (error) {
      console.error('Failed to initialize Claude Code SDK:', error);
      this.isConnected = false;
      this.emit('connectionChanged', { connected: false, error: error.message });
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
      if (this.claudeCode) {
        const response = await this.claudeCode.query(message);
        return response;
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // Method to manually add files to Claude's context
  async addFilesToContext(filePaths) {
    try {
      if (this.claudeCode) {
        for (const filePath of filePaths) {
          // This would use Claude Code SDK method to add file to context
          // await this.claudeCode.addFileToContext(filePath);
          this.addFileToContext(filePath, 'added');
        }
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  disconnect() {
    if (this.claudeCode) {
      // Clean up Claude Code connection
      this.claudeCode = null;
    }
    this.isConnected = false;
    this.currentSession = null;
    this.activeFiles.clear();
    this.contextFiles.clear();
    this.emit('connectionChanged', { connected: false });
  }
}

module.exports = ClaudeCodeIntegration;