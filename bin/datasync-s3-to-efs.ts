#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatasyncS3ToEfsStack } from '../lib/datasync-s3-to-efs-stack';

const app = new cdk.App();
new DatasyncS3ToEfsStack(app, 'DatasyncS3ToEfsStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});