#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { GitHubStack } from '../lib/github';
import { DefaultConstruct } from '../lib/contruct';
import { ImageRepoStack } from '../lib/image_repo';
import { LambdaStack } from '../lib/lambda';
import { VpcStack } from '../lib/network';
import { DatabaseStack } from '../lib/database';

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

// add github role arn and region to secrets and environment

const imageRepoStack = new ImageRepoStack(app, 'LambdaAppImageRepoStack', { imageRepoConfig: { repoName: "reonic-lambda-app" } })
githubStack.grantEcrAccess(imageRepoStack.repo.repositoryArn)

// vpc
const vpcStack = new VpcStack(envScope, "MainVpcStack", {
  vpcConfig: {
    name: "main_vpc",
    cidr: "10.0.0.0/16",
    maxAzs: 3,
    natGateways: 0,
    subnets: {
      frontend: { cidrMask: 24, type: ec2.SubnetType.PUBLIC },
      app: { cidrMask: 24, type: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      db: { cidrMask: 24, type: ec2.SubnetType.PRIVATE_ISOLATED },
    },
  },
})

const databaseStack = new DatabaseStack(envScope, "MainPgDb", {
  vpc: vpcStack.vpc,
})

databaseStack.addDependency(vpcStack);

const lambdaStack = new LambdaStack(envScope, "LambdaStack", {
  vpc: vpcStack.vpc,
  dbSecretArn: databaseStack.databaseSecret.secretArn,
  repo: imageRepoStack.repo,
  lambdaConfig: {
    functionName: `${env}__reonic-lambda-app`
  }
})

lambdaStack.addDependency(vpcStack);
lambdaStack.addDependency(databaseStack);
lambdaStack.addDependency(imageRepoStack);
