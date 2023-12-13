import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface BastionProps {
    vpc: ec2.IVpc,
    fs: efs.IFileSystem
}

export class Bastion extends Construct {
    constructor(scope: Construct, id: string, props: BastionProps) {
        super(scope, id);

        const host = new ec2.BastionHostLinux(this, 'Bastion', { 
            vpc: props.vpc,
            requireImdsv2: true,
            machineImage: ec2.MachineImage.latestAmazonLinux2()
        });

        host.instance.addUserData(
            'sudo yum install -y amazon-efs-utils',
            `mkdir /efs && mount -t efs -o tls,iam ${props.fs.fileSystemId}:/ /efs`
        )

        props.fs.connections.allowDefaultPortFrom(host);
        host.node.addDependency(props.fs.mountTargetsAvailable);
        host.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
    }
}