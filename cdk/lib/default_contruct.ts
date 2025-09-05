import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";


export class DefaultConstruct extends Construct {
  private readonly id: string
  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.id = id

    console.log(`######## 🚀 Running Environment: ${id} ########`)

    // Default tags for this construct and children
    cdk.Tags.of(this).add("Infra", "ReonicDevOpsStack");
    cdk.Tags.of(this).add("Environment", id);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }

  toString(): string {
    return this.id
  }
}
