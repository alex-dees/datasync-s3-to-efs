import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface BastionProps {
    vpc: ec2.IVpc,
    fsid: string
}

export class Bastion extends Construct {
  readonly host : ec2.BastionHostLinux;

  constructor(scope: Construct, id: string, props: BastionProps) {
    super(scope, id);
    
    const userData = ec2.UserData.forLinux();

    userData.addCommands(
      'sudo yum install -y amazon-efs-utils',
      `mkdir /efs && mount -t efs -o tls,iam ${props.fsid}:/ /efs`
    );

    this.host = new ec2.BastionHostLinux(this, 'Bastion', { 
      vpc: props.vpc,
      requireImdsv2: true,
      machineImage: ec2.MachineImage.latestAmazonLinux2({ userData })
    });
    
    this.host.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
  }
}