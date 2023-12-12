import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as efs from 'aws-cdk-lib/aws-efs';

import { Net } from './constructs/net';
import { Bastion } from './constructs/bastion';
import { Sync, TriggerType } from './constructs/sync';

export class DatasyncS3ToEfsStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const vpc = new Net(this, 'Net').vpc;

        const bkt = new s3.Bucket(this, 'Bkt', {
            enforceSSL: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            encryption: s3.BucketEncryption.S3_MANAGED
        });

        const fs = new efs.FileSystem(this, 'Fs', {
            vpc,
            encrypted: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });

        const ap = fs.addAccessPoint('FsAp', {
            path: '/app',
            createAcl: {
                ownerGid: '1001',
                ownerUid: '1001', //ssm-user,
                permissions: '750'
            },
            posixUser: {
                gid: '1001',
                uid: '1001'
            }
        });

        const bastion = new Bastion(this, 'Bastion', {
            vpc,
            fsid: fs.fileSystemId
        });

        fs.connections.allowDefaultPortFrom(bastion.host);

        const sync = new Sync(this, 'Sync', {
            vpc,
            src: bkt,
            dst: { fs, ap },
            trigger: {
                type: TriggerType.SCHEDULE,
                minutes: 2
            }
        });
    }
}
