export interface HealthHistoryRun {
  checkedAt: Date;
  unhealthyCount: number;
  result: unknown;
}

export const HEALTH_HISTORY_LIMIT = 30;

/** Stable, presentation-ready history model used by the admin chart/table. */
export function buildHealthHistoryViewModel(runs: HealthHistoryRun[]) {
  return runs.slice(0, HEALTH_HISTORY_LIMIT).map((run) => ({
    checkedAt: run.checkedAt,
    unhealthyCount: run.unhealthyCount,
    slugs: Array.isArray(run.result)
      ? run.result
          .map((item) => (item && typeof item === 'object' && 'slug' in item ? item.slug : null))
          .filter((slug): slug is string => typeof slug === 'string' && slug.length > 0)
      : [],
  }));
}