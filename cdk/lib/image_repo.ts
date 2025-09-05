import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";

export interface ImageRepoConfig {
  repoName: string;
}

export interface ImageRepoStackProps extends cdk.StackProps {
  imageRepoConfig: ImageRepoConfig;
}

export class ImageRepoStack extends cdk.Stack {

  public readonly repo: ecr.Repository;

  constructor(scope: cdk.App, id: string, props: ImageRepoStackProps) {
    super(scope, id, props);

    // Create a new ECR repository
    this.repo = new ecr.Repository(this, "ReonicBaseImageRepo", {
      repositoryName: props.imageRepoConfig.repoName,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      imageScanOnPush: true,
    });

    new cdk.CfnOutput(this, "RepoUri", {
      value: this.repo.repositoryUri, // e.g. 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-lambda-base
    });
  }
}
