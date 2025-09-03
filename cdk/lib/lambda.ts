import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import * as ecr from "aws-cdk-lib/aws-ecr";

export interface LambdaConfig {
  memorySize: number;
  timeout: cdk.Duration;
  reservedConcurrentExecutions?: number;
}

export const DEFAULT_LAMBDA_CONFIG: LambdaConfig = {
  memorySize: 512,
  timeout: cdk.Duration.seconds(30),
  reservedConcurrentExecutions: undefined
};

export interface LambdaStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  database: rds.DatabaseInstance;
  databaseSecret: secretsmanager.Secret;
  imageUri: string;
  environment: string;
  component?: string;
  lambdaConfig?: Partial<LambdaConfig>;
}

export class LambdaStack extends cdk.Stack {
  public readonly lambdaFunction: lambda.Function;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const config: LambdaConfig = {
      ...DEFAULT_LAMBDA_CONFIG,
      ...props.lambdaConfig
    };

    // Security group for Lambda
    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for Lambda function',
      allowAllOutbound: true,
    });

    // Update database security group to allow Lambda access
    const dbSecurityGroup = props.database.connections.securityGroups[0];
    dbSecurityGroup.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda access to PostgreSQL'
    );

    const repo = ecr.Repository.fromRepositoryAttributes(this, "ImportedRepo", {
      repositoryName: "my-lambda",
      repositoryArn: "arn:aws:ecr:us-east-1:123456789012:repository/my-lambda",
    });

    // Create Lambda function with Docker image
    this.lambdaFunction = new lambda.Function(this, 'AppFunction', {
      runtime: lambda.Runtime.FROM_IMAGE,
      handler: lambda.Handler.FROM_IMAGE,
      code: lambda.Code.fromEcrImage(repo, {
        tagOrDigest: "latest", // from the image URL
      }),
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [this.lambdaSecurityGroup],
      memorySize: config.memorySize,
      timeout: config.timeout,
      reservedConcurrentExecutions: config.reservedConcurrentExecutions,
      environment: {
        DB_SECRET_NAME: props.databaseSecret.secretArn,
        AWS_REGION: props.env?.region || ''
      },
    });

    // Grant Lambda permission to read database secret
    props.databaseSecret.grantRead(this.lambdaFunction);

    // Add tags
    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('Component', props.component || 'compute');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // // Outputs
    // new cdk.CfnOutput(this, 'LambdaFunctionArn', {
    //   value: this.lambdaFunction.functionArn,
    //   description: 'Lambda function ARN',
    // });

    // new cdk.CfnOutput(this, 'LambdaFunctionName', {
    //   value: this.lambdaFunction.functionName,
    //   description: 'Lambda function name',
    // });
  }
}
