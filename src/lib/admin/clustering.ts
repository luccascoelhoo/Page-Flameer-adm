/**
 * Lightweight, deterministic k-means used to auto-discover behavioural
 * communities among users without any server round-trip.
 *
 * The implementation is intentionally seedable (no Math.random) so the same
 * dataset always yields the same clusters — important for a management tool
 * where operators must be able to trust that segments are stable across reloads.
 */

import { mean, stddev } from './stats';

export interface FeatureVector<T> {
  item: T;
  features: number[];
}

export interface Cluster<T> {
  id: number;
  centroid: number[];
  members: T[];
  size: number;
}

/** Z-score normalisation per feature dimension, returning the scalers too. */
export function normalize<T>(vectors: FeatureVector<T>[]): {
  normalized: FeatureVector<T>[];
  means: number[];
  stds: number[];
} {
  if (vectors.length === 0) return { normalized: [], means: [], stds: [] };
  const dims = vectors[0].features.length;
  const means: number[] = [];
  const stds: number[] = [];
  for (let d = 0; d < dims; d++) {
    const col = vectors.map((v) => v.features[d]);
    means[d] = mean(col);
    stds[d] = stddev(col) || 1; // guard zero-variance dimensions
  }
  const normalized = vectors.map((v) => ({
    item: v.item,
    features: v.features.map((f, d) => (f - means[d]) / stds[d]),
  }));
  return { normalized, means, stds };
}

function euclidean(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

/**
 * Deterministic k-means++ style seeding: pick the first centroid as the point
 * nearest the global mean, then greedily pick the farthest remaining points.
 */
function seedCentroids<T>(vectors: FeatureVector<T>[], k: number): number[][] {
  const dims = vectors[0].features.length;
  const globalMean = Array.from({ length: dims }, (_, d) =>
    mean(vectors.map((v) => v.features[d]))
  );
  const used = new Set<number>();
  const centroids: number[][] = [];

  // first centroid: closest to the global mean (stable anchor)
  let firstIdx = 0;
  let firstDist = Infinity;
  vectors.forEach((v, i) => {
    const dist = euclidean(v.features, globalMean);
    if (dist < firstDist) {
      firstDist = dist;
      firstIdx = i;
    }
  });
  used.add(firstIdx);
  centroids.push([...vectors[firstIdx].features]);

  // remaining centroids: farthest point from the nearest existing centroid
  while (centroids.length < k) {
    let bestIdx = -1;
    let bestDist = -Infinity;
    vectors.forEach((v, i) => {
      if (used.has(i)) return;
      const nearest = Math.min(...centroids.map((c) => euclidean(v.features, c)));
      if (nearest > bestDist) {
        bestDist = nearest;
        bestIdx = i;
      }
    });
    if (bestIdx === -1) break;
    used.add(bestIdx);
    centroids.push([...vectors[bestIdx].features]);
  }
  return centroids;
}

export function kmeans<T>(
  vectors: FeatureVector<T>[],
  k: number,
  maxIterations = 50
): Cluster<T>[] {
  if (vectors.length === 0) return [];
  const effectiveK = Math.max(1, Math.min(k, vectors.length));
  let centroids = seedCentroids(vectors, effectiveK);
  let assignments = new Array(vectors.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    // assignment step
    vectors.forEach((v, i) => {
      let best = 0;
      let bestDist = Infinity;
      centroids.forEach((c, ci) => {
        const dist = euclidean(v.features, c);
        if (dist < bestDist) {
          bestDist = dist;
          best = ci;
        }
      });
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    });

    // update step
    const dims = vectors[0].features.length;
    const next: number[][] = Array.from({ length: effectiveK }, () =>
      new Array(dims).fill(0)
    );
    const counts = new Array(effectiveK).fill(0);
    vectors.forEach((v, i) => {
      const c = assignments[i];
      counts[c]++;
      for (let d = 0; d < dims; d++) next[c][d] += v.features[d];
    });
    centroids = next.map((c, ci) =>
      counts[ci] === 0 ? centroids[ci] : c.map((s) => s / counts[ci])
    );

    if (!changed && iter > 0) break;
  }

  const clusters: Cluster<T>[] = centroids.map((centroid, id) => ({
    id,
    centroid,
    members: [],
    size: 0,
  }));
  vectors.forEach((v, i) => {
    clusters[assignments[i]].members.push(v.item);
  });
  clusters.forEach((c) => (c.size = c.members.length));
  return clusters.filter((c) => c.size > 0);
}

/**
 * Silhouette-inspired heuristic to suggest a sensible k in [2, maxK]:
 * we favour the k that maximises average inter-centroid separation while
 * keeping clusters populated. Cheap and good enough for operator-facing UI.
 */
export function suggestK<T>(vectors: FeatureVector<T>[], maxK = 5): number {
  if (vectors.length < 6) return Math.min(2, vectors.length);
  let bestK = 2;
  let bestScore = -Infinity;
  for (let k = 2; k <= Math.min(maxK, vectors.length); k++) {
    const clusters = kmeans(vectors, k);
    if (clusters.length < 2) continue;
    // average pairwise centroid distance, penalised by size imbalance
    let sep = 0;
    let pairs = 0;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        sep += euclidean(clusters[i].centroid, clusters[j].centroid);
        pairs++;
      }
    }
    const avgSep = pairs === 0 ? 0 : sep / pairs;
    const sizes = clusters.map((c) => c.size);
    const balance = 1 - stddev(sizes) / (mean(sizes) || 1);
    const score = avgSep * (0.5 + 0.5 * Math.max(0, balance));
    if (score > bestScore) {
      bestScore = score;
      bestK = k;
    }
  }
  return bestK;
}
