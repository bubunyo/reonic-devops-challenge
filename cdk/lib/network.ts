import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

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

    // Create network connectivity to secrets manager
    new ec2.InterfaceVpcEndpoint(this, 'SecretsManagerEndpoint', {
      vpc: this.vpc,
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }
    });
  }
}
