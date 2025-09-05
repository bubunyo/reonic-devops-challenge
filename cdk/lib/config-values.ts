import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { EnvironmentConfigs } from './configs';

// Configuration constants
export const ENVIRONMENT_CONFIGS: EnvironmentConfigs = {
  global: {
    imageRepo: {
      repoName: "reonic-lambda-app"
    },
    github: {
      owner: 'bubunyo',
      repo: 'reonic-devops-challenge',
      branches: ['main', 'develop']
    }
  },

  dev: {
    vpc: {
      name: "main_vpc",
      cidr: "10.0.0.0/16",
      maxAzs: 2,
      natGateways: 0,
      subnets: {
        frontend: { cidrMask: 24, type: ec2.SubnetType.PUBLIC },
        app: { cidrMask: 24, type: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        db: { cidrMask: 24, type: ec2.SubnetType.PRIVATE_ISOLATED }
      }
    },
    database: {
      instanceClass: ec2.InstanceClass.BURSTABLE3,
      instanceSize: ec2.InstanceSize.MICRO,
      allocatedStorage: 20,
      databaseName: 'postgres',
      port: 5432,
      backupRetentionDays: 3,
      deletionProtection: false
    },
    lambda: {
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      reservedConcurrentExecutions: undefined,
      repoTag: "latest"
    }
  },

  staging: {
    vpc: {
      name: "main_vpc",
      cidr: "10.0.0.0/16",
      maxAzs: 3,
      natGateways: 1, // NAT Gateway for staging
      subnets: {
        frontend: { cidrMask: 24, type: ec2.SubnetType.PUBLIC },
        app: { cidrMask: 24, type: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        db: { cidrMask: 24, type: ec2.SubnetType.PRIVATE_ISOLATED }
      }
    },
    database: {
      instanceClass: ec2.InstanceClass.BURSTABLE3,
      instanceSize: ec2.InstanceSize.SMALL, // Larger instance for staging
      allocatedStorage: 50, // More storage for staging
      databaseName: 'postgres',
      port: 5432,
      backupRetentionDays: 7, // Longer backup retention
      deletionProtection: true // Protection for staging
    },
    lambda: {
      memorySize: 1024, // More memory for staging
      timeout: cdk.Duration.seconds(90), // Longer timeout
      reservedConcurrentExecutions: 10, // Reserved concurrency
      repoTag: "latest"
    }
  }
};
