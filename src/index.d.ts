/**
 * Money-Machine Type Definitions
 */

export class MoneyMachine {
  constructor(config?: MoneyMachineConfig);
  initialize(): Promise<MoneyMachine>;
  addAccount(platform: string, credentials: any): Promise<void>;
  loadStrategy(strategy: StrategyModule): Promise<string>;
  start(strategyIds?: string[]): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<MachineStatus>;
  getEarningsReport(): Promise<EarningsReport>;
}

export class Logger {
  constructor(config?: LoggerConfig);
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, error?: Error, context?: any): void;
  audit(action: string, result: any, context?: any): void;
  metric(metricName: string, value: number, tags?: any): void;
  getLogs(level?: string): any[];
  getAuditLog(): any[];
  getMetrics(metricName?: string): Map<string, any> | any[];
  clear(type?: 'all' | 'logs' | 'audit' | 'metrics'): void;
  getStats(): LogStats;
}

export class RateLimiter {
  constructor(config?: RateLimiterConfig, logger?: Logger);
  acquireToken(platform: string, actionType?: string): Promise<boolean>;
  releaseToken(platform: string, actionType?: string): void;
  getRemainingQuota(platform: string): TokenQuota;
  getResetTime(platform: string): ResetTimes;
  waitForToken(platform: string, maxWaitMs?: number): Promise<boolean>;
  setPlatformLimits(platform: string, limits: PlatformLimits): void;
  getStats(): Record<string, PlatformState>;
  reset(): void;
}

export class ComplianceEngine {
  constructor(
    config?: ComplianceConfig,
    logger?: Logger,
    rateLimiter?: RateLimiter
  );
  checkAction(action: Action, context?: any): Promise<ComplianceResult>;
  logAction(action: Action, result: any, context?: any): Promise<void>;
  generateComplianceReport(): ComplianceReport;
  clearViolations(): void;
}

export class AccountManager {
  constructor(config?: any, logger?: Logger);
  addAccount(platform: string, credentials: any): Promise<void>;
  getAccount(platform: string): Promise<any | null>;
  rotateCredentials(platform: string, newCredentials: any): Promise<void>;
  checkAccountHealth(platform: string): Promise<AccountHealth>;
  listAccounts(): Promise<AccountInfo[]>;
  removeAccount(platform: string): Promise<boolean>;
  disableAccount(platform: string, reason?: string): Promise<void>;
  enableAccount(platform: string): Promise<void>;
}

export class StrategyManager {
  constructor(
    config?: any,
    logger?: Logger,
    complianceEngine?: ComplianceEngine
  );
  loadStrategy(strategyModule: StrategyModule): Promise<string>;
  executeStrategy(strategyId: string, context?: any): Promise<StrategyResult>;
  pauseStrategy(strategyId: string, reason?: string): Promise<void>;
  getStrategyStatus(strategyId: string): Promise<StrategyStatus | null>;
  getPerformanceMetrics(): Promise<Record<string, StrategyMetrics>>;
  listStrategies(): string[];
}

export class Scheduler {
  constructor(config?: any, logger?: Logger);
  scheduleTask(task: Task, schedule: Schedule): string;
  executeTask(taskId: string): Promise<void>;
  cancelTask(taskId: string): boolean;
  getUpcomingTasks(): Task[];
  shutdown(): void;
}

export abstract class StrategyModule {
  constructor(config?: any);
  readonly name: string;
  readonly description: string;
  readonly requiredAccounts: string[];
  readonly estimatedTimeToFirstDollar: string;
  readonly automationLevel: number;
  initialize(context: StrategyContext): Promise<void>;
  execute(context: StrategyContext): Promise<StrategyResult>;
  validate(context: StrategyContext): Promise<ValidationResult>;
  shutdown(): Promise<void>;
  getStatus(): Promise<StrategyStatus>;
  getMetrics(): Promise<StrategyMetrics>;
}

export class GitHubSponsorsStrategy extends StrategyModule {
  constructor(config?: GitHubSponsorsConfig);
  readonly name: 'github-sponsors';
  readonly description: string;
  readonly requiredAccounts: string[];
  readonly estimatedTimeToFirstDollar: string;
  readonly automationLevel: number;
  initialize(context: StrategyContext): void;
  execute(context: StrategyContext): Promise<GitHubSponsorsResult>;
  validate(context: StrategyContext): ValidationResult;
  shutdown(): void;
  getStatus(): GitHubSponsorsStatus;
}

export function createMoneyMachine(
  config?: MoneyMachineConfig
): Promise<MoneyMachine>;

// Type Definitions

export interface MoneyMachineConfig {
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  strictCompliance?: boolean;
  maxConcurrentStrategies?: number;
}

export interface LoggerConfig {
  level?: 'debug' | 'info' | 'warn' | 'error';
  enableAudit?: boolean;
  enableMetrics?: boolean;
}

export interface LogStats {
  total: number;
  byLevel: Record<string, number>;
  auditEntries: number;
  metricCount: number;
}

export interface RateLimiterConfig {
  platformLimits?: Record<string, PlatformLimits>;
}

export interface PlatformLimits {
  requestsPerMinute?: number;
  requestsPerHour?: number;
  burstLimit?: number;
}

export interface TokenQuota {
  minute: number;
  hour: number;
  burst: number;
}

export interface ResetTimes {
  minute: Date;
  hour: Date;
  minutesUntilMinuteReset: number;
  minutesUntilHourReset: number;
}

export interface PlatformState {
  limits: PlatformLimits;
  remaining: TokenQuota;
  lastRefill: {
    minute: number;
    hour: number;
  };
}

export interface ComplianceConfig {
  strictMode?: boolean;
}

export interface Action {
  type: string;
  [key: string]: any;
}

export interface ComplianceResult {
  passed: boolean;
  checks: ComplianceCheck[];
  action: string;
  timestamp: string;
}

export interface ComplianceCheck {
  category: string;
  passed: boolean;
  violations?: string[];
  [key: string]: any;
}

export interface ComplianceReport {
  totalViolations: number;
  violations: ComplianceResult[];
  generatedAt: string;
}

export interface AccountHealth {
  platform: string;
  healthy: boolean;
  status?: string;
  daysSinceLastUse?: number;
  lastHealthCheck?: string;
  reason?: string;
}

export interface AccountInfo {
  platform: string;
  status: string;
  addedAt: string;
  lastUsed: string | null;
  lastHealthCheck: string | null;
}

export interface StrategyContext {
  logger?: Logger;
  accountManager?: AccountManager;
  complianceEngine?: ComplianceEngine;
  rateLimiter?: RateLimiter;
  [key: string]: any;
}

export interface StrategyResult {
  success: boolean;
  earnings?: number;
  actions?: number;
  errors?: string[];
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface StrategyStatus {
  name: string;
  status: string;
  earnings: number;
  actions: number;
  errorCount: number;
}

export interface StrategyMetrics {
  totalEarnings: number;
  totalActions: number;
  successRate: number;
  errors: any[];
}

export interface Task {
  id?: string;
  handler: () => Promise<void>;
  [key: string]: any;
}

export interface Schedule {
  intervalMs?: number;
  [key: string]: any;
}

export interface MachineStatus {
  initialized: boolean;
  running: boolean;
  accounts: AccountInfo[];
  strategies: Record<string, StrategyMetrics>;
  compliance: ComplianceReport;
  rateLimits: Record<string, PlatformState>;
}

export interface EarningsReport {
  totalEarnings: number;
  byStrategy: Record<string, StrategyMetrics>;
  generatedAt: string;
}

// GitHub Sponsors Strategy Types

export interface GitHubSponsorsConfig {
  githubToken?: string;
  login?: string;
  isOrganization?: boolean;
  apiUrl?: string;
}

export interface GitHubSponsorsResult {
  success: boolean;
  earnings?: number;
  earningsCents?: number;
  currency?: string;
  sponsorCount?: number;
  activeSponsorships?: number;
  hasSponsorsListing?: boolean;
  recurringMonthlyIncome?: number;
  goal?: SponsorsGoal | null;
  timestamp?: string;
  message?: string;
  verificationData?: {
    login: string;
    apiResponse: any;
    fetchedAt: string;
  };
  error?: string;
  errorCode?: string;
  hint?: string;
}

export interface SponsorsGoal {
  title: string;
  percentComplete: number;
  targetValue: number;
}

export interface GitHubSponsorsStatus extends StrategyStatus {
  lastFetchedData: any;
  config: {
    login?: string;
    isOrganization?: boolean;
    hasToken: boolean;
  };
}
