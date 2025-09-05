import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { VpcConfig } from './network';
import { DatabaseConfig } from './database';
import { LambdaConfig } from './lambda';
import { GitHubConfig } from './github';
import { ImageRepoConfig } from './image_repo';

// Global settings (not environment-specific)
export interface GlobalSettings {
  imageRepo: ImageRepoConfig;
  github: GitHubConfig;
}

// Environment-specific stack configurations
export interface StackConfigs {
  vpc: VpcConfig;
  database: DatabaseConfig;
  lambda: LambdaConfig;
}

// Complete configuration structure
export interface EnvironmentConfigs {
  global: GlobalSettings;
  dev: StackConfigs;
  staging: StackConfigs;
}

// Import configuration values from separate file
import { ENVIRONMENT_CONFIGS } from './config-values';

// Re-export for convenience
export { ENVIRONMENT_CONFIGS };

// Validation functions
export function validateVpcConfig(config: VpcConfig): void {
  if (!config.cidr.match(/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/)) {
    throw new Error(`Invalid CIDR format: ${config.cidr}`);
  }
  if (config.maxAzs < 1 || config.maxAzs > 6) {
    throw new Error(`maxAzs must be between 1 and 6, got: ${config.maxAzs}`);
  }
  if (config.natGateways < 0) {
    throw new Error(`natGateways cannot be negative, got: ${config.natGateways}`);
  }
}

export function validateDatabaseConfig(config: DatabaseConfig): void {
  if (config.allocatedStorage < 20 || config.allocatedStorage > 65536) {
    throw new Error(`allocatedStorage must be between 20 and 65536 GB, got: ${config.allocatedStorage}`);
  }
  if (config.port < 1024 || config.port > 65535) {
    throw new Error(`port must be between 1024 and 65535, got: ${config.port}`);
  }
  if (config.backupRetentionDays < 0 || config.backupRetentionDays > 35) {
    throw new Error(`backupRetentionDays must be between 0 and 35, got: ${config.backupRetentionDays}`);
  }
  if (!config.databaseName || config.databaseName.length === 0) {
    throw new Error('databaseName cannot be empty');
  }
}

export function validateLambdaConfig(config: LambdaConfig): void {
  if (config.memorySize < 128 || config.memorySize > 10240) {
    throw new Error(`memorySize must be between 128 and 10240 MB, got: ${config.memorySize}`);
  }
  if (config.timeout.toSeconds() < 1 || config.timeout.toSeconds() > 900) {
    throw new Error(`timeout must be between 1 and 900 seconds, got: ${config.timeout.toSeconds()}`);
  }
  if (config.reservedConcurrentExecutions !== undefined &&
    (config.reservedConcurrentExecutions < 0 || config.reservedConcurrentExecutions > 1000)) {
    throw new Error(`reservedConcurrentExecutions must be between 0 and 1000, got: ${config.reservedConcurrentExecutions}`);
  }
}

export function validateGitHubConfig(config: GitHubConfig): void {
  if (!config.owner || config.owner.length === 0) {
    throw new Error('GitHub owner cannot be empty');
  }
  if (!config.repo || config.repo.length === 0) {
    throw new Error('GitHub repo cannot be empty');
  }
  if (config.branches && config.branches.length === 0) {
    throw new Error('GitHub branches array cannot be empty if provided');
  }
}

export function validateImageRepoConfig(config: ImageRepoConfig): void {
  if (!config.repoName || config.repoName.length === 0) {
    throw new Error('Image repository name cannot be empty');
  }
  // ECR repository name validation
  if (!/^[a-z0-9](?:[a-z0-9\-_.]*[a-z0-9])?$/.test(config.repoName)) {
    throw new Error(`Invalid ECR repository name: ${config.repoName}`);
  }
}

// Main validation function
export function validateEnvironmentConfig(environment: string): StackConfigs {
  const config = ENVIRONMENT_CONFIGS[environment as keyof typeof ENVIRONMENT_CONFIGS];

  if (!config) {
    throw new Error(`Unknown environment: ${environment}. Available environments: ${Object.keys(ENVIRONMENT_CONFIGS).filter(k => k !== 'global').join(', ')}`);
  }

  if (environment === 'global') {
    throw new Error('Cannot get stack configs for global environment');
  }

  const stackConfig = config as StackConfigs;

  // Validate all configurations
  validateVpcConfig(stackConfig.vpc);
  validateDatabaseConfig(stackConfig.database);
  validateLambdaConfig(stackConfig.lambda);

  return stackConfig;
}

// Helper function to get environment configuration with validation
export function getEnvironmentConfig(environment: string): StackConfigs {
  return validateEnvironmentConfig(environment);
}

// Helper function to get global configuration with validation
export function getGlobalConfig(): GlobalSettings {
  validateGitHubConfig(ENVIRONMENT_CONFIGS.global.github);
  validateImageRepoConfig(ENVIRONMENT_CONFIGS.global.imageRepo);

  return ENVIRONMENT_CONFIGS.global;
}

// Helper function to auto-detect environment with fallback
export function detectEnvironment(app: cdk.App): string {
  const env = app.node.tryGetContext("env") || "dev";

  // Validate environment exists
  if (!['dev', 'staging'].includes(env)) {
    console.warn(`Warning: Unknown environment '${env}', falling back to 'dev'`);
    return "dev";
  }

  return env;
}
