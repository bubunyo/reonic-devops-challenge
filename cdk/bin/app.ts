#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { GitHubStack } from '../lib/github';
import { DefaultConstruct } from '../lib/default_contruct';
import { ImageRepoStack } from '../lib/image_repo';
import { LambdaStack } from '../lib/lambda';
import { VpcStack } from '../lib/network';
import { DatabaseStack } from '../lib/database';
import { detectEnvironment, getEnvironmentConfig, getGlobalConfig } from '../lib/configs';

const app = new cdk.App()

// Auto-detect environment with validation
const env = detectEnvironment(app);

// Get configurations
const globalConfig = getGlobalConfig();
const envConfig = getEnvironmentConfig(env);

const envScope = new DefaultConstruct(app, env);

// GitHub stack (global scope)
const githubStack = new GitHubStack(app, 'GitHubStack', {
  githubConfig: globalConfig.github,
  environment: 'global'
});

// Image repository stack
const imageRepoStack = new ImageRepoStack(app, 'LambdaAppImageRepoStack', {
  imageRepoConfig: globalConfig.imageRepo
})
githubStack.grantEcrAccess(imageRepoStack.repo.repositoryArn)

// VPC stack with environment-specific configuration
const vpcStack = new VpcStack(envScope, "MainVpcStack", {
  vpcConfig: envConfig.vpc
})

// Database stack with environment-specific configuration
const databaseStack = new DatabaseStack(envScope, "MainPgDb", {
  vpc: vpcStack.vpc,
  databaseConfig: envConfig.database
})

databaseStack.addDependency(vpcStack);

// Lambda stack with environment-specific configuration
const lambdaStack = new LambdaStack(envScope, "LambdaStack", {
  vpc: vpcStack.vpc,
  dbSecretArn: databaseStack.databaseSecret.secretArn,
  repo: imageRepoStack.repo,
  lambdaConfig: envConfig.lambda,
  functionName: `${env}__reonic-lambda-app`
})

lambdaStack.addDependency(vpcStack);
lambdaStack.addDependency(databaseStack);
lambdaStack.addDependency(imageRepoStack);
