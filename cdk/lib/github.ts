import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface GitHubConfig {
  owner: string;
  repo: string;
  branches?: string[];
}

export const DEFAULT_GITHUB_CONFIG = {
  branches: ['main', 'develop']
};

export interface GitHubStackProps extends cdk.StackProps {
  githubConfig: GitHubConfig;
  environment: string;
  component?: string;
}

export class GitHubStack extends cdk.Stack {
  public readonly oidcProvider: iam.OpenIdConnectProvider;
  public readonly deploymentRole: iam.Role;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: GitHubStackProps) {
    super(scope, id, props);

    const config = {
      ...DEFAULT_GITHUB_CONFIG,
      ...props.githubConfig
    };

    // GitHub OIDC Provider
    this.oidcProvider = new iam.OpenIdConnectProvider(this, 'GitHubOIDCProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    // IAM role for GitHub Actions
    const conditions = {
      StringLike: {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": `repo:${config.owner}/${config.repo}:*` // Fix branch wild cards
      },
    };

    this.deploymentRole = new iam.Role(this, 'GitHubActionsRole', {
      assumedBy: new iam.WebIdentityPrincipal(this.oidcProvider.openIdConnectProviderArn, conditions),
      description: 'Role for GitHub Actions to deploy AWS resources',
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // Base permissions for deployment workflows
    // this.deploymentRole.addToPolicy(new iam.PolicyStatement({
    //   effect: iam.Effect.ALLOW,
    //   actions: [
    //     'cloudwatch:PutMetricData',
    //     'logs:CreateLogGroup',
    //     'logs:CreateLogStream',
    //     'logs:PutLogEvents'
    //   ],
    //   resources: ['*']
    // }));

    // Scoped CloudWatch permissions
    this.deploymentRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'], // CloudWatch metrics require * resource
      conditions: {
        StringLike: {
          'cloudwatch:namespace': 'Deployment/*'
        }
      }
    }));

    this.deploymentRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        // 'cloudwatch:PutMetricData',
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: [
        `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/*`,
        `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/apigateway/*`
      ]
    }));

    this.deploymentRole.addToPolicy(new iam.PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: [
        `arn:aws:iam::${this.account}:role/cdk-hnb659fds-deploy-role-${this.account}-${this.region}`,
      ],
    }));

    this.deploymentRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["sts:AssumeRole",],
      resources: [
        // `arn:aws:iam::${this.account}:role/cdk-hnb659fds-*`,
        `arn:aws:iam::${this.account}:role/cdk-hnb659fds-deploy-role-${this.account}-${this.region}`,
        `arn:aws:iam::${this.account}:role/cdk-hnb659fds-file-publishing-role-${this.account}-${this.region}`
      ]
    }));

    // SNS topic for deployment notifications
    this.alarmTopic = new sns.Topic(this, 'DeploymentAlarmTopic', {
      displayName: `${props.environment} Deployment Notifications`
    });

    // Grant SNS publish permission
    this.alarmTopic.grantPublish(this.deploymentRole);


    // Outputs
    new cdk.CfnOutput(this, 'GitHubRoleArn', {
      value: this.deploymentRole.roleArn,
      description: 'GitHub Actions IAM role ARN',
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS topic for deployment notifications',
    });
  }

  // Helper method to grant ECR permissions
  public grantEcrAccess(repositoryArn: string): void {
    this.deploymentRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'ecr:PutImage',
        'ecr:InitiateLayerUpload',
        'ecr:UploadLayerPart',
        'ecr:CompleteLayerUpload'
      ],
      resources: [repositoryArn] // GetAuthorizationToken needs * resource
    }));
    this.deploymentRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:GetAuthorizationToken',
      ],
      resources: ["*"], // GetAuthorizationToken needs * resource
    }));

    this.deploymentRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:UpdateFunctionCode',
        'lambda:GetFunction',
        'lambda:GetFunctionConfiguration',
        'lambda:InvokeFunction'
      ],
      resources: [`arn:aws:lambda:${this.region}:${this.account}:function:*__reonic-lambda-app`]
    }));
  }
}
