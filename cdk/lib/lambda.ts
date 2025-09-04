import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export interface LambdaConfig {
  functionName?: string;
  memorySize: number;
  timeout: cdk.Duration;
  reservedConcurrentExecutions?: number;
  repoTag: string;
}

export const DEFAULT_LAMBDA_CONFIG: LambdaConfig = {
  memorySize: 512,
  timeout: cdk.Duration.seconds(60),
  reservedConcurrentExecutions: undefined,
  repoTag: "latest"
};

export interface LambdaStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  dbSecretArn: string;
  repo: ecr.Repository;
  lambdaConfig?: Partial<LambdaConfig>;
}

export class LambdaStack extends cdk.Stack {
  public readonly lambdaFunction: lambda.Function;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;
  public readonly functionUrl: lambda.FunctionUrl;

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

    this.lambdaFunction = new lambda.DockerImageFunction(this, "LambdaDockerFunc", {
      functionName: props.lambdaConfig?.functionName,
      code: lambda.DockerImageCode.fromEcr(props.repo, {
        tagOrDigest: props.lambdaConfig?.repoTag, // from the image URL
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
        DB_SECRET_NAME: props.dbSecretArn,
      },
    });

    this.functionUrl = this.lambdaFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM, // will change for api gateway
      // authType: lambda.FunctionUrlAuthType.NONE, // will change for api gateway
    })

    const dbSecret = secretsmanager.Secret.fromSecretCompleteArn(this, 'DbSecret', props.dbSecretArn);

    // Grant Lambda permission to read database secret
    dbSecret.grantRead(this.lambdaFunction);

    // API Gateway -> Lambda integration
    const apiGateway = new apigateway.LambdaRestApi(this, 'Api', {
      handler: this.lambdaFunction,
    });

    // Grant API Gateway permission
    this.lambdaFunction.addPermission('ApiGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `${apiGateway.arnForExecuteApi()}/*/*`,
    });



    // Outputs
    new cdk.CfnOutput(this, 'LambdaFunctionArn', {
      value: this.lambdaFunction.functionArn,
      description: 'Lambda function ARN',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionUrl', {
      value: this.functionUrl.url,
      description: 'Lambda function Url',
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: apiGateway.url,
      description: 'Api Gateway Endpoint',
    });
  }
}
