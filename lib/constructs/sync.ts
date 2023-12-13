import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ds from 'aws-cdk-lib/aws-datasync';
import * as events from 'aws-cdk-lib/aws-events';
import * as nodefn from 'aws-cdk-lib/aws-lambda-nodejs';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';

export enum TriggerType {
    S3,
    SCHEDULE
}

export interface SyncProps {
    vpc: ec2.IVpc,
    src: s3.Bucket,
    dst: {
        fs: efs.FileSystem
        ap: efs.AccessPoint
    },
    trigger: {
        type: TriggerType,
        minutes?: number
    }
}

const service = new iam.ServicePrincipal('datasync.amazonaws.com');

export class Sync extends Construct {
    constructor(scope: Construct, id: string, props: SyncProps) {
        super(scope, id);
        const sloc = this.srcLoc(props);
        const dloc = this.dstLoc(props);
        const tasks = this.tasks(sloc, dloc);
        this.sync(tasks, props);
    }

    private srcLoc(props: SyncProps) {
        const role = new iam.Role(this, 'SrcRole', {
            assumedBy: service
        });

        props.src.grantDelete(role);
        props.src.grantReadWrite(role);

        const loc = new ds.CfnLocationS3(this, 'SrcLoc', {
            s3BucketArn: props.src.bucketArn,
            s3Config: { bucketAccessRoleArn: role.roleArn }
        });

        loc.node.addDependency(role);

        return loc;
    }

    private dstLoc(props: SyncProps) {
        const vpc = props.vpc;

        const role = new iam.Role(this, 'DstRole', {
            assumedBy: service
        });

        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['elasticfilesystem:*'],
            resources: [props.dst.fs.fileSystemArn]
        }));

        const sg = new ec2.SecurityGroup(this, 'DstSg', { vpc });

        const sgArn = cdk.Arn.format({
            service: 'ec2',
            resource: 'security-group',
            resourceName: sg.securityGroupId
        },
        sg.stack);

        props.dst.fs.connections.allowDefaultPortFrom(sg);

        return vpc.privateSubnets.map((s, i) => {
            const subArn = cdk.Arn.format({
                service: 'ec2',
                resource: 'subnet',
                resourceName: s.subnetId
            },
            s.stack);

            const loc = new ds.CfnLocationEFS(this, `DstLoc${i}`, {
                ec2Config: {
                    subnetArn: subArn,
                    securityGroupArns: [sgArn]
                },
                inTransitEncryption: 'TLS1_2',
                fileSystemAccessRoleArn: role.roleArn,
                accessPointArn: props.dst.ap.accessPointArn,
                efsFilesystemArn: props.dst.fs.fileSystemArn
            });
            //https://github.com/aws/aws-cdk/issues/16826#issuecomment-938004363
            loc.node.addDependency(props.dst.fs.mountTargetsAvailable);
            return loc;
        });
    }

    private tasks(src: ds.CfnLocationS3, dst: ds.CfnLocationEFS[]) {
        const lg = new logs.LogGroup(this, 'DsLogs', {
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });

        lg.addToResourcePolicy(new iam.PolicyStatement({
            principals: [service],
            effect: iam.Effect.ALLOW,
            actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
            resources: [lg.logGroupArn]
        }));

        return dst.map((d, i) => new ds.CfnTask(this, `Task${i}`, {
            cloudWatchLogGroupArn: lg.logGroupArn,
            sourceLocationArn: src.attrLocationArn,
            destinationLocationArn: d.attrLocationArn,
            options: {
                uid: 'NONE',
                gid: 'NONE',
                logLevel: 'TRANSFER',
                posixPermissions: 'NONE',
                preserveDeletedFiles: 'REMOVE'
            }
        }));
    }

    private sync(tasks: ds.CfnTask[], props: SyncProps) {
        const arns = tasks.map(t => t.attrTaskArn);

        const fn = new nodefn.NodejsFunction(this, 'DsFn', {
            timeout: cdk.Duration.seconds(15),
            environment: { TASKS: JSON.stringify({ arns }) },
            entry: path.join(__dirname, '../../src', 'index.ts')
        });

        fn.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['datasync:StartTaskExecution'],
            resources: arns
        }));

        fn.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['ec2:DescribeNetworkInterfaces'],
            resources: ['*']
        }));

        const trigger = props.trigger;
        switch (trigger.type) {
            case TriggerType.S3:
                fn.addEventSource(new sources.S3EventSource(props.src, {
                    events: [
                        s3.EventType.OBJECT_CREATED,
                        s3.EventType.OBJECT_REMOVED
                    ]
                }));
                break;
            case TriggerType.SCHEDULE:
                new events.Rule(this, 'Rule', {
                    targets: [new targets.LambdaFunction(fn)],
                    schedule: events.Schedule.rate(cdk.Duration.minutes(trigger.minutes!))
                });
                break;            
            default:
                throw new Error('unhandled trigger type');
        }        
    }
}