import * as cron from 'node-cron';
import { EventEmitter } from 'events';
import { logger } from '../logger/logger';

export interface ScheduledJob {
  id: string;
  name: string;
  cronExpression: string;
  task: () => Promise<void> | void;
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
  errorCount: number;
  maxRetries: number;
  retryDelay: number; // in milliseconds
  description?: string;
  metadata?: Record<string, any>;
}

export interface JobResult {
  success: boolean;
  error?: string;
  duration: number;
  timestamp: Date;
}

export class SchedulerService extends EventEmitter {
  private jobs: Map<string, ScheduledJob> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private isRunning = false;

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('job:started', (jobId: string) => {
      logger.info(`Job started: ${jobId}`);
    });

    this.on('job:completed', (jobId: string, result: JobResult) => {
      logger.info(`Job completed: ${jobId}`, {
        success: result.success,
        duration: result.duration
      });
    });

    this.on('job:failed', (jobId: string, error: string) => {
      logger.error(`Job failed: ${jobId}`, { error });
    });
  }

  /**
   * Add a new scheduled job
   */
  addJob(job: Omit<ScheduledJob, 'id' | 'isActive' | 'errorCount'>): string {
    const id = this.generateJobId();
    const scheduledJob: ScheduledJob = {
      ...job,
      id,
      isActive: true,
      errorCount: 0
    };

    this.jobs.set(id, scheduledJob);
    this.scheduleJob(scheduledJob);

    logger.info(`Job added: ${job.name}`, {
      id,
      cronExpression: job.cronExpression
    });

    return id;
  }

  /**
   * Remove a scheduled job
   */
  removeJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.warn(`Job not found: ${jobId}`);
      return false;
    }

    // Stop the cron job
    const cronJob = this.cronJobs.get(jobId);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(jobId);
    }

    // Remove from jobs map
    this.jobs.delete(jobId);

    logger.info(`Job removed: ${job.name}`, { id: jobId });
    return true;
  }

  /**
   * Start a specific job
   */
  startJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.warn(`Job not found: ${jobId}`);
      return false;
    }

    if (job.isActive) {
      logger.warn(`Job already active: ${jobId}`);
      return false;
    }

    job.isActive = true;
    this.scheduleJob(job);

    logger.info(`Job started: ${job.name}`, { id: jobId });
    return true;
  }

  /**
   * Stop a specific job
   */
  stopJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.warn(`Job not found: ${jobId}`);
      return false;
    }

    if (!job.isActive) {
      logger.warn(`Job already stopped: ${jobId}`);
      return false;
    }

    job.isActive = false;

    // Stop the cron job
    const cronJob = this.cronJobs.get(jobId);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(jobId);
    }

    logger.info(`Job stopped: ${job.name}`, { id: jobId });
    return true;
  }

  /**
   * Run a job immediately
   */
  async runJobNow(jobId: string): Promise<JobResult> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    return this.executeJob(job);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get a specific job
   */
  getJob(jobId: string): ScheduledJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get active jobs
   */
  getActiveJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values()).filter(job => job.isActive);
  }

  /**
   * Update job configuration
   */
  updateJob(jobId: string, updates: Partial<ScheduledJob>): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.warn(`Job not found: ${jobId}`);
      return false;
    }

    // Stop existing cron job if cron expression changed
    if (updates.cronExpression && updates.cronExpression !== job.cronExpression) {
      const cronJob = this.cronJobs.get(jobId);
      if (cronJob) {
        cronJob.stop();
        this.cronJobs.delete(jobId);
      }
    }

    // Update job
    Object.assign(job, updates);

    // Reschedule if active
    if (job.isActive) {
      this.scheduleJob(job);
    }

    logger.info(`Job updated: ${job.name}`, { id: jobId, updates });
    return true;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Scheduler already running');
      return;
    }

    this.isRunning = true;

    // Start all active jobs
    for (const job of this.jobs.values()) {
      if (job.isActive) {
        this.scheduleJob(job);
      }
    }

    logger.info('Scheduler started', {
      totalJobs: this.jobs.size,
      activeJobs: this.getActiveJobs().length
    });
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Scheduler not running');
      return;
    }

    this.isRunning = false;

    // Stop all cron jobs
    for (const [jobId, cronJob] of this.cronJobs.entries()) {
      cronJob.stop();
      logger.debug(`Stopped cron job: ${jobId}`);
    }
    this.cronJobs.clear();

    logger.info('Scheduler stopped');
  }

  /**
   * Schedule a job using cron
   */
  private scheduleJob(job: ScheduledJob): void {
    if (!this.isRunning || !job.isActive) {
      return;
    }

    // Validate cron expression
    if (!cron.validate(job.cronExpression)) {
      logger.error(`Invalid cron expression: ${job.cronExpression}`, { jobId: job.id });
      return;
    }

    // Create cron task
    const cronTask = cron.schedule(job.cronExpression, async () => {
      await this.executeJob(job);
    }, {
      scheduled: false,
      timezone: 'Asia/Kolkata' // Indian timezone
    });

    // Store cron job
    this.cronJobs.set(job.id, cronTask);

    // Start the cron task
    cronTask.start();

    // Calculate next run time
    const nextRun = this.getNextRunTime(job.cronExpression);
    if (nextRun) {
      job.nextRun = nextRun;
    }

    logger.debug(`Job scheduled: ${job.name}`, {
      id: job.id,
      nextRun: job.nextRun
    });
  }

  /**
   * Execute a job
   */
  private async executeJob(job: ScheduledJob): Promise<JobResult> {
    const startTime = Date.now();
    const result: JobResult = {
      success: false,
      duration: 0,
      timestamp: new Date()
    };

    try {
      this.emit('job:started', job.id);

      // Execute the task
      await job.task();

      // Update job status
      job.lastRun = new Date();
      job.errorCount = 0;
      const nextRun = this.getNextRunTime(job.cronExpression);
      if (nextRun) {
        job.nextRun = nextRun;
      }

      result.success = true;
      result.duration = Date.now() - startTime;

      this.emit('job:completed', job.id, result);

      logger.debug(`Job executed successfully: ${job.name}`, {
        id: job.id,
        duration: result.duration
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update error count
      job.errorCount++;

      result.success = false;
      result.error = errorMessage;
      result.duration = Date.now() - startTime;

      this.emit('job:failed', job.id, errorMessage);

      logger.error(`Job execution failed: ${job.name}`, {
        id: job.id,
        error: errorMessage,
        errorCount: job.errorCount
      });

      // Retry logic
      if (job.errorCount < job.maxRetries) {
        setTimeout(() => {
          logger.info(`Retrying job: ${job.name}`, {
            id: job.id,
            attempt: job.errorCount + 1
          });
          this.executeJob(job);
        }, job.retryDelay);
      } else {
        logger.error(`Job exceeded max retries: ${job.name}`, {
          id: job.id,
          maxRetries: job.maxRetries
        });
      }
    }

    return result;
  }

  /**
   * Get next run time for a cron expression
   */
  private getNextRunTime(cronExpression: string): Date | undefined {
    try {
      // For now, return a simple calculation
      // In a real implementation, you might want to use a library like 'cron-parser'
      const now = new Date();
      // Add 1 hour as a simple fallback
      const nextRun = new Date(now.getTime() + 60 * 60 * 1000);
      return nextRun;
    } catch (error) {
      logger.error('Error calculating next run time', { cronExpression, error });
      return undefined;
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    totalJobs: number;
    activeJobs: number;
    jobs: ScheduledJob[];
  } {
    return {
      isRunning: this.isRunning,
      totalJobs: this.jobs.size,
      activeJobs: this.getActiveJobs().length,
      jobs: this.getAllJobs()
    };
  }

  /**
   * Clear all jobs
   */
  clearAllJobs(): void {
    this.stop();
    this.jobs.clear();
    logger.info('All jobs cleared');
  }
}

// Export singleton instance
export const scheduler = new SchedulerService();

// Predefined trading jobs
export const tradingJobs = {
  // Market data refresh every minute during trading hours
  marketDataRefresh: {
    name: 'Market Data Refresh',
    cronExpression: '* 9-15 * * 1-5', // Every minute, 9 AM to 3 PM, Mon-Fri
    task: async () => {
      logger.info('Refreshing market data...');
      // Implementation will be added when market data service is integrated
    },
    maxRetries: 3,
    retryDelay: 5000,
    description: 'Refresh market data every minute during trading hours'
  },

  // Risk check every 5 minutes
  riskCheck: {
    name: 'Risk Check',
    cronExpression: '*/5 9-15 * * 1-5', // Every 5 minutes, 9 AM to 3 PM, Mon-Fri
    task: async () => {
      logger.info('Performing risk check...');
      // Implementation will be added when risk service is integrated
    },
    maxRetries: 2,
    retryDelay: 10000,
    description: 'Check portfolio risk every 5 minutes during trading hours'
  },

  // Daily cleanup at 6 PM
  dailyCleanup: {
    name: 'Daily Cleanup',
    cronExpression: '0 18 * * 1-5', // 6 PM, Mon-Fri
    task: async () => {
      logger.info('Performing daily cleanup...');
      // Implementation will be added
    },
    maxRetries: 1,
    retryDelay: 30000,
    description: 'Daily cleanup and maintenance tasks'
  },

  // Weekly backup on Sunday
  weeklyBackup: {
    name: 'Weekly Backup',
    cronExpression: '0 2 * * 0', // 2 AM on Sunday
    task: async () => {
      logger.info('Performing weekly backup...');
      // Implementation will be added
    },
    maxRetries: 2,
    retryDelay: 60000,
    description: 'Weekly database and configuration backup'
  }
}; 