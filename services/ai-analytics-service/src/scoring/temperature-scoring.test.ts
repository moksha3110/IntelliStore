import { describe, expect, it } from 'vitest';
import { scoreFileTemperature, type ScoringOptions } from './temperature-scoring';

const NOW = new Date('2026-01-30T00:00:00.000Z');

const options: ScoringOptions = {
  recencyHalfLifeDays: 14,
  frequencyCap: 20,
  hotThreshold: 50,
  coldAgeThresholdDays: 30,
};

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('scoreFileTemperature', () => {
  it('classifies a recently and frequently accessed file as hot', () => {
    const result = scoreFileTemperature(
      { createdAt: daysAgo(60), accessCount: 15, lastAccessedAt: daysAgo(1), now: NOW },
      options,
    );

    expect(result.tier).toBe('hot');
    expect(result.score).toBeGreaterThanOrEqual(options.hotThreshold);
    expect(result.recommendation).toMatch(/keep on hot storage/);
  });

  it('classifies a file untouched for a long time as cold', () => {
    const result = scoreFileTemperature(
      { createdAt: daysAgo(200), accessCount: 3, lastAccessedAt: daysAgo(90), now: NOW },
      options,
    );

    expect(result.tier).toBe('cold');
    expect(result.recommendation).toMatch(/consider moving to cold\/archive storage/);
  });

  it('treats a brand new, never-accessed file as "too new" rather than a confident cold recommendation', () => {
    const result = scoreFileTemperature(
      { createdAt: daysAgo(2), accessCount: 0, lastAccessedAt: null, now: NOW },
      options,
    );

    expect(result.tier).toBe('cold');
    expect(result.score).toBe(0);
    expect(result.recommendation).toMatch(/too new to classify confidently/);
  });

  it('recommends archiving a file that has never been accessed and is past the cold-age threshold', () => {
    const result = scoreFileTemperature(
      { createdAt: daysAgo(120), accessCount: 0, lastAccessedAt: null, now: NOW },
      options,
    );

    expect(result.tier).toBe('cold');
    expect(result.score).toBe(0);
    expect(result.recommendation).toMatch(/Never accessed since upload/);
  });

  it('decays the recency contribution by half at exactly one half-life', () => {
    const freshScore = scoreFileTemperature(
      { createdAt: daysAgo(365), accessCount: 0, lastAccessedAt: daysAgo(0), now: NOW },
      options,
    ).score;
    const halfLifeScore = scoreFileTemperature(
      { createdAt: daysAgo(365), accessCount: 0, lastAccessedAt: daysAgo(options.recencyHalfLifeDays), now: NOW },
      options,
    ).score;

    // Pure recency contribution (no access-count component here), so the
    // half-life score should be close to half the fresh score.
    expect(halfLifeScore).toBeCloseTo(freshScore / 2, 0);
  });

  it('caps the frequency contribution at the configured frequencyCap', () => {
    const atCap = scoreFileTemperature(
      { createdAt: daysAgo(365), accessCount: options.frequencyCap, lastAccessedAt: daysAgo(0), now: NOW },
      options,
    ).score;
    const overCap = scoreFileTemperature(
      {
        createdAt: daysAgo(365),
        accessCount: options.frequencyCap * 10,
        lastAccessedAt: daysAgo(0),
        now: NOW,
      },
      options,
    ).score;

    expect(overCap).toBe(atCap);
  });

  it('weighs recency more heavily than frequency', () => {
    const recentButRarelyAccessed = scoreFileTemperature(
      { createdAt: daysAgo(365), accessCount: 1, lastAccessedAt: daysAgo(0), now: NOW },
      options,
    ).score;
    const oldButHeavilyAccessed = scoreFileTemperature(
      { createdAt: daysAgo(365), accessCount: options.frequencyCap, lastAccessedAt: daysAgo(90), now: NOW },
      options,
    ).score;

    expect(recentButRarelyAccessed).toBeGreaterThan(oldButHeavilyAccessed);
  });

  it('produces a score within 0-100 for extreme inputs', () => {
    const zero = scoreFileTemperature(
      { createdAt: daysAgo(1000), accessCount: 0, lastAccessedAt: daysAgo(1000), now: NOW },
      options,
    ).score;
    const max = scoreFileTemperature(
      { createdAt: daysAgo(1), accessCount: 1000, lastAccessedAt: daysAgo(0), now: NOW },
      options,
    ).score;

    expect(zero).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(100);
  });
});
