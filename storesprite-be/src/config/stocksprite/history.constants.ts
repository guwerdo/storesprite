/** Number of run-history rows kept per mapping (pruned on each dispatch). */
export const HISTORY_RETENTION = 100;

/** Maximum allowed wall-clock duration of a worker run before it is swept as stale (2h). */
export const MAX_RUN_DURATION_MS = 2 * 60 * 60 * 1000;
