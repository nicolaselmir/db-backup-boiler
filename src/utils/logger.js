import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';

class Logger {
  constructor() {
    this.logLevel = config.app.logLevel || 'info';
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    this.logDir = path.join(__dirname, '../../logs');

    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    this.logFile = path.join(this.logDir, 'app.log');
  }

  log(level, message, meta = {}) {
    if (this.levels[level] <= this.levels[this.logLevel]) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level,
        message,
        ...meta,
      };

      const logString = JSON.stringify(logEntry);

      console[level](logString);

      fs.appendFileSync(this.logFile, `${logString}\n`);
    }
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }
}

export default new Logger();