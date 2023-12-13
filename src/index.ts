import { Handler } from "aws-lambda";
import * as ds from '@aws-sdk/client-datasync';

export const handler: Handler = async (event, context) => {
    try {
        const client = new ds.DataSyncClient();
        const tasks = JSON.parse(<string>process.env['TASKS']);
        const execs = tasks.arns.map((arn: string) => client.send(
            new ds.StartTaskExecutionCommand({ TaskArn: arn })
        ));
        await Promise.all(execs);
    } catch (e) {
        console.error(e);
        throw e;
    }
}