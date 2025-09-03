#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { GitHubStack } from '../lib/github';
import { DefaultConstruct } from '../lib/contruct';
import { ImageRepoStack } from '../lib/image_repo';
import { LambdaStack } from '../lib/lambda';

const app = new cdk.App()

const env = app.node.tryGetContext("env") || "dev";
const envScope = new DefaultConstruct(app, env);

// github is on a globalscope
const githubStack = new GitHubStack(app, 'GitHubStack', {
  githubConfig: {
    owner: 'bubunyo',
    repo: 'reonic-devops-challenge'
  },
  environment: 'global'
});

const imageRepoStack = new ImageRepoStack(app, 'ImageRepoStack', { imageRepoConfig: { repoName: "reonic-devops-challenge" } })

githubStack.grantEcrAccess(imageRepoStack.repo.repositoryArn)

// const lambdaStack = new LambdaStack(envScope, "LambdaStack", {})

// githubStack.grantLambdaUpdateAccess(lambdaStack.lambdaFunction.functionArn)
