
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { DatasyncS3ToEfsStack } from './datasync-s3-to-efs-stack';

class AppStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);
    new DatasyncS3ToEfsStack(this, 'DatasyncS3ToEfsStack', props);
  }
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
        dockerEnabledForSynth: true,
        synth: new pipelines.ShellStep('Synth', {
            input: pipelines.CodePipelineSource.connection('alex-dees/datasync-s3-to-efs', 'main', {
                connectionArn: 'arn:aws:codestar-connections:us-east-1:844540003076:connection/2f8ebd4e-dee4-4ebd-815b-8021abc56369'
            }),
            commands: [
                'npm ci',
                'npm run build',
                'npx cdk synth',
            ]
        }),
        codeBuildDefaults: {
            rolePolicy: [
                new iam.PolicyStatement({
                    actions: ['ec2:DescribeAvailabilityZones'],
                    resources: ['*']
                  })                
            ]            
        }
    });

    // deploy the pipeline first before adding the stage
    pipeline.addStage(new AppStage(this, 'App', props));
  }
}