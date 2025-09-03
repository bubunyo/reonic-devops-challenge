import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

const myVpc: VpcConfig = {
  name: "main_vpc",
  cidr: "10.0.0.0/16",
  maxAzs: 3,
  natGateways: 0,
  subnets: {
    frontend: { cidrMask: 24, type: ec2.SubnetType.PUBLIC },
    app: { cidrMask: 24, type: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    db: { cidrMask: 24, type: ec2.SubnetType.PRIVATE_ISOLATED },
  },
};

export interface SubnetConfig {
  cidrMask: number;
  type: ec2.SubnetType;
}

export interface VpcConfig {
  name: string
  cidr: string;
  maxAzs: number;
  natGateways: number;
  subnets: Record<string, SubnetConfig>;
}

export interface VpcStackProps extends cdk.StackProps {
  vpcConfig: VpcConfig;
}

export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: VpcStackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, props.vpcConfig.name, {
      ipAddresses: ec2.IpAddresses.cidr(props.vpcConfig.cidr),
      maxAzs: props.vpcConfig.maxAzs,
      subnetConfiguration: Object.entries(props.vpcConfig.subnets).map(
        ([key, subnet]) => ({
          cidrMask: subnet.cidrMask,
          name: key,
          subnetType: subnet.type,
        })
      ),
      natGateways: props.vpcConfig.natGateways, // No NAT gateways. 
    });

    // Output VPC ID for reference
    new cdk.CfnOutput(this, `${props.vpcConfig.name}::VPCId`, {
      value: this.vpc.vpcId,
      description: 'VPC ID',
    });
  }
}
