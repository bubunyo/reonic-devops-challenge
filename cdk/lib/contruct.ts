import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class DefaultConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    console.log(`###############################################`)
    console.log(`###############################################`)
    console.log(`######## Deploying for Environment: ${id}`)
    console.log(`###############################################`)
    console.log(`###############################################`)

    // Default tags for this construct and children
    cdk.Tags.of(this).add("Infra", "ReonicDevOpsStack");
    cdk.Tags.of(this).add("Environment", id);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
