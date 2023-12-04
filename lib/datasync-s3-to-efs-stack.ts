import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class DatasyncS3ToEfsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
  }
}
