export interface IConnectionTestRunnerService {
  runTest(connectionId: string, userId: string, workerToken: string, backendUrl: string): Promise<void>;
}
