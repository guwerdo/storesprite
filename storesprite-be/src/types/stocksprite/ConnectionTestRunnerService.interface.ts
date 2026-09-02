export interface IConnectionTestRunnerService {
  runTest(connectionId: string, userId: string, token: string, backendUrl: string): Promise<void>;
  runMapping(mappingId: string, runId: string, userId: string, token: string, backendUrl: string): Promise<void>;
}
