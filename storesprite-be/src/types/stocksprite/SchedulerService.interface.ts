export interface ISchedulerService {
  runDue(now: Date): Promise<{ dispatched: string[] }>;
}
