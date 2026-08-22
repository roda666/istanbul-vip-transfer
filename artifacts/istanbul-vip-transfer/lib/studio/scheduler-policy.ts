/**
 * Keep CRON_SECRET-authorized legacy schedules working until an operator
 * explicitly disables Studio scheduling. Invalid explicit values fail closed.
 */
export function canRunStudioScheduler(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return !normalized || normalized === 'true';
}