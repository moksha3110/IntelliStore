export type StorageTier = 'hot' | 'cold';

export interface TemperatureInput {
  createdAt: string;
  accessCount: number;
  lastAccessedAt: string | null;
  /** Injectable clock for deterministic tests; defaults to the real current time. */
  now?: Date;
}

export interface ScoringOptions {
  /** Days after which recency contribution decays to half its value. */
  recencyHalfLifeDays: number;
  /** Access count at which the frequency contribution saturates at 100. */
  frequencyCap: number;
  /** Minimum score (0-100) to be classified "hot". */
  hotThreshold: number;
  /** Below this age, a never-accessed file is "too new" rather than confidently cold. */
  coldAgeThresholdDays: number;
}

export interface TemperatureResult {
  score: number;
  tier: StorageTier;
  recommendation: string;
}

function diffDays(later: Date, earlier: Date): number {
  return Math.max(0, (later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Deterministic, explainable hot/cold scoring heuristic — not a trained
 * model. Combines exponential recency decay (how long since last access)
 * with a capped access-frequency signal, the same class of feature
 * engineering behind real tiering systems like S3 Intelligent-Tiering.
 * Recency is weighted more heavily (0.7) than frequency (0.3): a file that
 * was hammered with requests months ago but hasn't been touched since is a
 * better cold-storage candidate than one accessed a handful of times today.
 */
export function scoreFileTemperature(
  input: TemperatureInput,
  options: ScoringOptions,
): TemperatureResult {
  const now = input.now ?? new Date();
  const ageDays = diffDays(now, new Date(input.createdAt));
  const recencyDays = input.lastAccessedAt ? diffDays(now, new Date(input.lastAccessedAt)) : null;

  const recencyScore =
    recencyDays === null ? 0 : 100 * Math.pow(0.5, recencyDays / options.recencyHalfLifeDays);
  const frequencyScore = (Math.min(input.accessCount, options.frequencyCap) / options.frequencyCap) * 100;

  const score = Math.round(0.7 * recencyScore + 0.3 * frequencyScore);
  const tier: StorageTier = score >= options.hotThreshold ? 'hot' : 'cold';

  return { score, tier, recommendation: buildRecommendation(tier, ageDays, recencyDays, input.accessCount, options) };
}

function buildRecommendation(
  tier: StorageTier,
  ageDays: number,
  recencyDays: number | null,
  accessCount: number,
  options: ScoringOptions,
): string {
  if (tier === 'hot') {
    return `Frequently accessed (${accessCount} time${accessCount === 1 ? '' : 's'}) — keep on hot storage.`;
  }

  if (accessCount === 0 && ageDays < options.coldAgeThresholdDays) {
    return `Uploaded ${Math.round(ageDays)} day(s) ago with no accesses yet — too new to classify confidently.`;
  }

  if (recencyDays === null) {
    return `Never accessed since upload ${Math.round(ageDays)} day(s) ago — consider archiving.`;
  }

  return `Not accessed in ${Math.round(recencyDays)} day(s) — consider moving to cold/archive storage.`;
}
