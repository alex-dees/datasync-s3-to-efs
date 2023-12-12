import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export class Net extends Construct {
  readonly vpc : ec2.IVpc;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.vpc = new ec2.Vpc(this, 'Vpc', {
        maxAzs: 2,
        ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/24'),
        subnetConfiguration: [
            {
                name: 'public',
                subnetType: ec2.SubnetType.PUBLIC
            },          
            {
                name: 'private',
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
            }
        ],
        gatewayEndpoints: {
            s3: { service: ec2.GatewayVpcEndpointAwsService.S3 }
        }
    });
  }
}