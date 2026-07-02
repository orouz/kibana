/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { estypes } from '@elastic/elasticsearch';
import type { ElasticsearchClient } from '@kbn/core/server';
import type { Logger } from '@kbn/logging';

type ResolvedIndices = Awaited<ReturnType<ElasticsearchClient['indices']['resolveIndex']>>;

const resolveArgs = (name: string[]) => ({
  name,
  expand_wildcards: ['open', 'closed', 'hidden'] as estypes.ExpandWildcards,
  ignore_unavailable: true,
  allow_no_indices: true,
});

const isNegation = (p: string) => p.startsWith('-');
const isWildcard = (p: string) => p.includes('*');
const toArray = (v: string | string[]): string[] => ([] as string[]).concat(v);

/** Names of the given resolved indices that are closed. */
const closedIndexNames = (indices: ResolvedIndices['indices']): string[] =>
  indices.filter((i) => i.attributes?.includes('closed')).map((i) => i.name);

/**
 * An ESQL `FROM` list, split into includes and (bare, un-prefixed) excludes. ESQL only subtracts a
 * negation from patterns listed before it, so `render` always emits includes ahead of excludes.
 */
interface FromPatterns {
  readonly includes: readonly string[];
  readonly excludes: readonly string[];
}

const parse = (patterns: string[]): FromPatterns => ({
  includes: patterns.filter((p) => !isNegation(p)),
  excludes: patterns.filter(isNegation).map((p) => p.slice(1)),
});

/** Empty when there are no includes — a negation-only `FROM` is meaningless (and invalid) ESQL. */
const render = ({ includes, excludes }: FromPatterns): string[] =>
  includes.length === 0 ? [] : [...includes, ...excludes.map((n) => `-${n}`)];

/** ESQL `FROM` throws index_not_found on a concrete name that doesn't exist. Drop those. */
const dropMissingConcreteIncludes = (
  from: FromPatterns,
  resolved: ResolvedIndices,
  logger: Logger
): FromPatterns => {
  const present = new Set<string>([
    ...resolved.indices.map((i) => i.name),
    ...resolved.aliases.map((a) => a.name),
    ...resolved.data_streams.map((d) => d.name),
  ]);
  const missing = from.includes.filter((p) => !isWildcard(p) && !present.has(p));
  if (missing.length === 0) return from;

  logger.warn(`Dropping non-existent explicit indices from ESQL FROM: ${missing.join(', ')}`);
  const drop = new Set(missing);
  return { ...from, includes: from.includes.filter((p) => !drop.has(p)) };
};

/**
 * ESQL `FROM` fails at resolution on a closed backing index (before allow_partial_results helps).
 * Exclude the offending data stream by name and re-add its open backing indices explicitly, so a
 * wildcard that matched the data stream no longer expands to the closed index.
 */
const excludeClosedIndices = (
  from: FromPatterns,
  resolved: ResolvedIndices,
  closedBacking: ReadonlySet<string>,
  logger: Logger
): FromPatterns => {
  const excludes = closedIndexNames(resolved.indices); // standalone closed indices
  const openBackingToAdd: string[] = [];

  for (const ds of resolved.data_streams) {
    const backing = toArray(ds.backing_indices);
    if (!backing.some((b) => closedBacking.has(b))) continue;
    excludes.push(ds.name);
    openBackingToAdd.push(...backing.filter((b) => !closedBacking.has(b)));
  }

  if (excludes.length === 0) return from;

  logger.warn(`Excluding closed indices/data streams from ESQL FROM: ${excludes.join(', ')}`);
  return {
    includes: [...from.includes, ...openBackingToAdd],
    excludes: [...from.excludes, ...excludes],
  };
};

/** Second lookup — the first resolve returns backing-index names without open/closed status. */
const resolveClosedBackingIndices = async (
  esClient: ElasticsearchClient,
  resolved: ResolvedIndices
): Promise<Set<string>> => {
  const backingNames = resolved.data_streams.flatMap((d) => toArray(d.backing_indices));
  if (backingNames.length === 0) return new Set();
  const { indices } = await esClient.indices.resolveIndex(resolveArgs(backingNames));
  return new Set(closedIndexNames(indices));
};

/**
 * Rewrites index patterns into an ESQL-safe `FROM` list, tolerating the two environmental hazards
 * that make ESQL fail at *resolution* time (which allow_partial_results cannot catch):
 *
 *   • a concrete index that doesn't exist        → dropped
 *   • a data stream with a closed backing index   → excluded, its open backing indices re-added
 *
 * Wildcards and healthy patterns pass through untouched. Returns `[]` when no includes survive
 * (nothing to query). On any resolve failure the input is returned unchanged — better to fail
 * loudly than to silently narrow the search.
 */
export const resolveEsqlFromPatterns = async (
  esClient: ElasticsearchClient,
  patterns: string[],
  logger: Logger
): Promise<string[]> => {
  const parsed = parse(patterns);
  if (parsed.includes.length === 0) return [];

  try {
    const resolved = await esClient.indices.resolveIndex(resolveArgs([...parsed.includes]));
    const closedBacking = await resolveClosedBackingIndices(esClient, resolved);

    const withoutMissing = dropMissingConcreteIncludes(parsed, resolved, logger);
    const safe = excludeClosedIndices(withoutMissing, resolved, closedBacking, logger);

    return render(safe);
  } catch (error) {
    logger.warn(
      `Failed to resolve ESQL FROM patterns (using them unchanged): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return render(parsed);
  }
};
