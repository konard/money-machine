/**
 * Scheduler - Task scheduling and execution
 */

export class Scheduler {
  constructor(config = {}, logger = null) {
    this.logger = logger;
    this.tasks = new Map();
    this.intervals = new Map();
    this.running = false;
  }

  scheduleTask(task, schedule) {
    const taskId = task.id || `task-${Date.now()}`;
    this.tasks.set(taskId, { ...task, schedule });

    if (schedule.intervalMs) {
      const interval = setInterval(() => {
        this.executeTask(taskId);
      }, schedule.intervalMs);
      this.intervals.set(taskId, interval);
    }

    return taskId;
  }

  async executeTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task || !task.handler) return;

    try {
      await task.handler();
    } catch (error) {
      if (this.logger) {
        this.logger.error('Task execution failed', error, { taskId });
      }
    }
  }

  cancelTask(taskId) {
    const interval = this.intervals.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(taskId);
    }
    return this.tasks.delete(taskId);
  }

  getUpcomingTasks() {
    return Array.from(this.tasks.values());
  }

  shutdown() {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
    this.running = false;
  }
}
