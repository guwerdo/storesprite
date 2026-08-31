import type {
  ConnectionTestProgress,
  IDataConnection,
} from '../../../types/stocksprite/DataConnection.interface.js';

export const TEST_RUN_TIMEOUT_MS = 15 * 60 * 1000;

const IN_PROGRESS_STAGES: readonly ConnectionTestProgress[] = ['start', 'download', 'convert'];

export function isInProgress(progress: ConnectionTestProgress | null | undefined): boolean {
  return progress !== null && progress !== undefined && IN_PROGRESS_STAGES.includes(progress);
}

export type ConnectionStatus =
  | 'active'
  | 'activeTesting'
  | 'inactive'
  | 'inactiveTesting'
  | 'untested'
  | 'error';

export function getConnectionStatus(connection: IDataConnection): ConnectionStatus {
  if (isInProgress(connection.testResult?.progress)) {
    return connection.isActive ? 'activeTesting' : 'inactiveTesting';
  }
  if (connection.isActive) return 'active';
  if (connection.testResult?.success === true) return 'inactive';
  if (connection.testResult?.success === false) return 'error';
  return 'untested';
}
