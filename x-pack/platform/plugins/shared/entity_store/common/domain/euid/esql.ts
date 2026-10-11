/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { entityStoreConditionToESQL as conditionToESQL } from '../../esql/condition_to_esql';
import { castField } from '../../esql/cast';
import type {
  EntityDefinitionWithoutId,
  EuidRankingBranch,
  FieldEvaluation,
  EntityType,
  EuidAttribute,
  FieldEvaluationWhenClauseFieldMappingThen,
} from '../definitions/entity_schema';
import { isSingleFieldIdentity } from '../definitions/entity_schema';
import {
  getEntityDefinitionWithoutId,
  type EntityDefinitionOptions,
} from '../definitions/registry';
import { USER_ENTITY_NAMESPACE } from '../definitions/user_entity_constants';
import {
  esqlIsNotNullOrEmpty,
  esqlIsNullOrEmpty,
  esqlPresentColumnName,
  esqlPresentOrNullColumnName,
} from '../../esql/strings';
import {
  applyWhenConditionTrueSetFields,
  documentPassesCalculatedIdentityPipelineGate,
  getDocument,
  getEffectiveEuidRanking,
  getFieldValue,
  getFieldsToBeFilteredOn,
  getFieldsToBeFilteredOut,
  getSourceFieldNames,
  isEuidField,
  isEuidSeparator,
} from './commons';
import {
  applyFieldEvaluations,
  getSourceMatchSpec,
  type SourceMatchSpec,
} from './field_evaluations';

/*
 * Every CASE and COALESCE this file emits takes only columns or literals, and every CASE has
 * a single condition. ES|QL evaluates such expressions a page at a time; with a nested
 * expression argument, or several CASE conditions, it falls back to one row at a time
 * (`Case#toEvaluator`, `Coalesce*Evaluator#toEvaluator`, and
 * `ExpressionEvaluator.Factory#eagerEvalSafeInLazy` in Elasticsearch). So nested arms are
 * assigned to their own columns first, which the outer expression then combines.
 */

/** EVAL columns an expression references; they must be assigned before it. */
export type Precomputes = Array<{ colName: string; esql: string }>;

/** Collects unique identity fields across all ranking branches that need `_present` columns. */
export function collectRankingFields(branches: EuidRankingBranch[]): Set<string> {
  const fields = new Set<string>();
  for (const { ranking } of branches) {
    if (ranking.length === 1 && ranking[0].length === 1 && isEuidField(ranking[0][0])) {
      continue;
    }
    for (const composedField of ranking) {
      for (const attr of composedField) {
        if (isEuidField(attr)) {
          fields.add(attr.field);
        }
      }
    }
  }
  return fields;
}

export function getEuidEsqlFilterBasedOnDocument(
  entityType: EntityType,
  doc: any
): string | undefined {
  if (!doc) {
    return undefined;
  }

  doc = getDocument(doc);
  const entityDefinition = getEntityDefinitionWithoutId(entityType);
  const { identityField } = entityDefinition;

  if (isSingleFieldIdentity(identityField)) {
    const value = getFieldValue(doc, identityField.singleField);
    if (value === undefined) {
      return undefined;
    }
    return `(${identityField.singleField} == "${escapeEsqlString(value)}")`;
  }

  const fieldEvaluations = identityField.fieldEvaluations ?? [];
  if (fieldEvaluations.length > 0) {
    const evaluated = applyFieldEvaluations(doc, fieldEvaluations);
    doc = { ...doc, ...evaluated };
  }
  if (entityDefinition.whenConditionTrueSetFieldsPreAgg?.length) {
    applyWhenConditionTrueSetFields(doc, entityDefinition.whenConditionTrueSetFieldsPreAgg);
  }
  if (entityDefinition.whenConditionTrueSetFieldsAfterStats?.length) {
    applyWhenConditionTrueSetFields(doc, entityDefinition.whenConditionTrueSetFieldsAfterStats);
  }
  if (!documentPassesCalculatedIdentityPipelineGate(doc, entityDefinition)) {
    return undefined;
  }
  const effectiveEuidRanking = getEffectiveEuidRanking(doc, identityField);
  const fieldsToBeFilteredOn = getFieldsToBeFilteredOn(doc, effectiveEuidRanking);
  if (fieldsToBeFilteredOn.rankingPosition === -1) {
    return undefined;
  }

  const evaluatedDestinations = new Set(fieldEvaluations.map((e) => e.destination));

  const onExpressions = Object.entries(fieldsToBeFilteredOn.values)
    .filter(([field]) => !evaluatedDestinations.has(field))
    .map(([field, value]) => `(${field} == "${escapeEsqlString(value)}")`);

  const toBeFilteredOut = getFieldsToBeFilteredOut(
    effectiveEuidRanking,
    fieldsToBeFilteredOn
  ).filter((field) => !evaluatedDestinations.has(field));
  const outExpressions = toBeFilteredOut.map((field) => `${esqlIsNullOrEmpty(field)}`);

  const allParts: string[] = [...onExpressions, ...outExpressions];

  if (fieldEvaluations.length > 0) {
    for (const evaluation of fieldEvaluations) {
      const { exactMatchFields, prefixMatchFields } = getSourceFieldNames(evaluation.sources);
      const sourceFields = [...exactMatchFields, ...prefixMatchFields];
      const hasEvaluatedSource = sourceFields.some((f) => evaluatedDestinations.has(f));
      if (hasEvaluatedSource) {
        continue;
      }
      const spec = getSourceMatchSpec(doc, evaluation);
      allParts.push(buildSourceClauseEsql(evaluation, spec));
    }
  }

  return `(${allParts.join(' AND ')})`;
}

function sourceToEsqlExpression(source: FieldEvaluation['sources'][number]): string {
  if ('field' in source) {
    return `MV_FIRST(${castField(source.field)})`;
  }
  return `MV_FIRST(SPLIT(MV_FIRST(${castField(source.firstChunkOfField)}), "${escapeEsqlString(
    source.splitBy
  )}"))`;
}

/**
 * Returns the entity-id expression for a ranking definition, referencing
 * pre-computed `<field>_present_or_null` columns.
 *
 * Output shape: a bare column ref (single field), `CONCAT(...)` (composed field),
 * or `COALESCE(arm1, arm2, …)` over arm columns named from `armColumnBase` (multiple
 * ranked arms).
 */
export function buildRankingCaseEsql(
  ranking: EuidAttribute[][],
  presentOrNullAliases: ReadonlyMap<string, string>,
  armColumnBase: string
): { expression: string; precomputes: Precomputes } {
  if (ranking.length === 0) {
    throw new Error('No euid fields found, invalid euid logic definition');
  }

  if (ranking.length === 1) {
    const comp = ranking[0];
    const firstAttr = comp[0];
    if (isEuidSeparator(firstAttr)) {
      throw new Error('Separator found in single field, invalid euid logic definition');
    }
    if (comp.length === 1 && isEuidField(firstAttr)) {
      // Single ranking, single field: bare _present_or_null ref (no COALESCE needed)
      return {
        expression: presentOrNullAliases.get(firstAttr.field) ?? `TO_STRING(${firstAttr.field})`,
        precomputes: [],
      };
    }
  }

  const arms = ranking.map((composedField) => {
    if (composedField.length === 1 && isEuidSeparator(composedField[0])) {
      throw new Error('Separator found in single field, invalid euid logic definition');
    }
    if (isEuidSeparator(composedField[0])) {
      throw new Error('The first field of a composed field cannot be a separator');
    }

    if (composedField.length === 1) {
      const f = composedField[0] as { field: string };
      return presentOrNullAliases.get(f.field) ?? `TO_STRING(${f.field})`;
    }

    // Composed arm: CONCAT over _present_or_null refs — NULL when any component is absent.
    const parts = composedField
      .map((attr) =>
        isEuidField(attr)
          ? presentOrNullAliases.get(attr.field) ?? `TO_STRING(${attr.field})`
          : `"${escapeEsqlString(attr.sep)}"`
      )
      .join(', ');
    return `CONCAT(${parts})`;
  });

  if (arms.length === 1) {
    return { expression: arms[0], precomputes: [] };
  }
  const precomputes = arms.map((esql, i) => ({ colName: `${armColumnBase}_arm${i}`, esql }));
  return {
    expression: `COALESCE(${precomputes.map(({ colName }) => colName).join(', ')})`,
    precomputes,
  };
}

/**
 * Returns a COALESCE expression that picks the first non-null/non-empty source variable,
 * over one column per source.
 */
export function buildSourcePickerEsql(
  sourceVariablesBaseName: string,
  count: number
): { expression: string; precomputes: Precomputes } {
  if (count < 1) {
    throw new Error('buildSourcePickerEsql requires at least one source variable');
  }
  const precomputes = Array.from({ length: count }, (_, i) => {
    const v = `${sourceVariablesBaseName}${i}`;
    return { colName: `${v}_value`, esql: `CASE(${v} IS NOT NULL AND ${v} != "", ${v})` };
  });
  return {
    expression: `COALESCE(${precomputes.map(({ colName }) => colName).join(', ')})`,
    precomputes,
  };
}

/**
 * Maps a field's value through an explicit lookup table: one single-condition CASE column
 * per entry, combined with COALESCE. NULL when the field is absent or its value is not in
 * the mapping — allowing the outer COALESCE to fall through to the next whenClause arm.
 */
function buildFieldMappingEsql(
  then: FieldEvaluationWhenClauseFieldMappingThen,
  columnBase: string
): { expression: string; precomputes: Precomputes } {
  const valueColumn = `${columnBase}_value`;
  const precomputes: Precomputes = [
    { colName: valueColumn, esql: `MV_FIRST(TO_STRING(${then.field}))` },
  ];
  const entryColumns = Object.entries(then.mapping).map(([from, to], i) => {
    const colName = `${columnBase}_${i}`;
    precomputes.push({
      colName,
      esql: `CASE(${valueColumn} == "${escapeEsqlString(from)}", "${escapeEsqlString(to)}")`,
    });
    return colName;
  });
  return {
    expression:
      entryColumns.length === 1 ? entryColumns[0] : `COALESCE(${entryColumns.join(', ')})`,
    precomputes,
  };
}

/**
 * Returns the destination field assignment expression and the columns it references.
 *
 * Without `whenClauses`: a simple fallback/pass-through CASE.
 * With `whenClauses`: a COALESCE of mapped arm columns (sourceMatchesAny or condition-based),
 * a fallback arm column, and a bare pass-through.
 */
export function buildDestinationFieldEsql(
  effectiveSourceName: string,
  destBase: string,
  fallbackExpression: string,
  whenClauses: FieldEvaluation['whenClauses']
): { expression: string; conditionPrecomputes: Precomputes } {
  const conditionPrecomputes: Precomputes = [];

  if (whenClauses.length === 0) {
    return {
      expression: `CASE(${effectiveSourceName} IS NULL OR ${effectiveSourceName} == "", ${fallbackExpression}, ${effectiveSourceName})`,
      conditionPrecomputes,
    };
  }

  const coalesceArms: string[] = [];
  for (const [i, clause] of whenClauses.entries()) {
    // CASE skips a NULL condition, so conditions need no `COALESCE(…, FALSE)` guard.
    let condition: string;
    if ('sourceMatchesAny' in clause) {
      const inList = clause.sourceMatchesAny.map((v) => `"${escapeEsqlString(v)}"`).join(', ');
      condition = `${effectiveSourceName} IN (${inList})`;
    } else {
      const colName = `${destBase}_arm${i}`;
      conditionPrecomputes.push({ colName, esql: `(${conditionToESQL(clause.condition)})` });
      condition = colName;
    }
    let thenExpr: string;
    if (typeof clause.then === 'string') {
      thenExpr = `"${escapeEsqlString(clause.then)}"`;
    } else {
      thenExpr = `${destBase}_map${i}`;
      const mapping = buildFieldMappingEsql(clause.then, thenExpr);
      conditionPrecomputes.push(...mapping.precomputes, {
        colName: thenExpr,
        esql: mapping.expression,
      });
    }
    const armColName = `${destBase}_then${i}`;
    conditionPrecomputes.push({ colName: armColName, esql: `CASE(${condition}, ${thenExpr})` });
    coalesceArms.push(armColName);
  }
  const fallbackColName = `${destBase}_fallback`;
  conditionPrecomputes.push({
    colName: fallbackColName,
    esql: `CASE(${effectiveSourceName} IS NULL OR ${effectiveSourceName} == "", ${fallbackExpression})`,
  });
  coalesceArms.push(fallbackColName);
  coalesceArms.push(effectiveSourceName);

  return { expression: `COALESCE(${coalesceArms.join(', ')})`, conditionPrecomputes };
}

/**
 * Returns comma-separated EVAL assignments for a single field evaluation
 * (e.g. `entity.namespace` derived from `event.module`).
 * May include intermediate source-picker and condition columns.
 */
export function buildOneFieldEvaluationEsql(evaluation: FieldEvaluation): string {
  const { destination, sources, fallbackValue, whenClauses } = evaluation;
  const sourceExpressions = sources.map((s) => sourceToEsqlExpression(s));
  const sourceVariablesBaseName = `_src_${destination.replace(/\./g, '_')}`;
  const effectiveSourceName = sourceVariablesBaseName;
  const fallbackExpression =
    fallbackValue === null ? 'NULL' : `"${escapeEsqlString(fallbackValue)}"`;
  const destBase = `_eval_${destination.replace(/\./g, '_')}`;

  if (sourceExpressions.length === 0) {
    throw new Error(
      `buildOneFieldEvaluationEsql: field evaluation "${destination}" has no sources`
    );
  }

  const assignments: string[] = [];

  if (sourceExpressions.length === 1) {
    assignments.push(`${effectiveSourceName} = ${sourceExpressions[0]}`);
  } else {
    for (let i = 0; i < sourceExpressions.length; i++) {
      assignments.push(`${sourceVariablesBaseName}${i} = ${sourceExpressions[i]}`);
    }
    const picker = buildSourcePickerEsql(sourceVariablesBaseName, sourceExpressions.length);
    for (const { colName, esql } of picker.precomputes) {
      assignments.push(`${colName} = ${esql}`);
    }
    assignments.push(`${effectiveSourceName} = ${picker.expression}`);
  }

  const { expression: destinationExpr, conditionPrecomputes } = buildDestinationFieldEsql(
    effectiveSourceName,
    destBase,
    fallbackExpression,
    whenClauses
  );
  for (const { colName, esql } of conditionPrecomputes) {
    assignments.push(`${colName} = ${esql}`);
  }
  assignments.push(`${destination} = ${destinationExpr}`);

  return assignments.join(',\n ');
}

function escapeEsqlString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildSourceClauseEsql(evaluation: FieldEvaluation, spec: SourceMatchSpec): string {
  if (spec.type === 'condition') {
    return `(${conditionToESQL(spec.condition)})`;
  }

  const { exactMatchFields, prefixMatchFields } = getSourceFieldNames(evaluation.sources);
  const allSourceFields = [...exactMatchFields, ...prefixMatchFields];

  if (spec.type === 'unknown') {
    return `(${allSourceFields.map((f) => esqlIsNullOrEmpty(f)).join(' AND ')})`;
  }

  const disjuncts = spec.values.map((v) => {
    const escaped = escapeEsqlString(v);
    const exactConds = exactMatchFields.map((f) => `(${f} == "${escaped}")`);
    const prefixConds = prefixMatchFields.map((f) => `STARTS_WITH(${f}, "${escaped}")`);
    const parts = [...exactConds, ...prefixConds];
    return parts.length === 1 ? parts[0] : `(${parts.join(' OR ')})`;
  });
  return disjuncts.length === 1 ? disjuncts[0] : `(${disjuncts.join(' OR ')})`;
}

export function getFieldEvaluationsEsql(entityType: EntityType): string | undefined {
  return getFieldEvaluationsEsqlFromDefinition(getEntityDefinitionWithoutId(entityType));
}

/** `field` is present and non-empty, referencing the raw field (no TO_STRING cast). */
function esqlRawFieldNonEmpty(field: string): string {
  return `(\`${field}\` IS NOT NULL AND \`${field}\` != "")`;
}

/** Fields composing the host-scoped user EUID, per the `entity.namespace == 'local'` ranking branch. */
const HOST_SCOPED_USER_FIELDS = ['user.name', 'host.id'] as const;

/**
 * ES|QL fragments for the host-scoped (non-IDP) user EUID:
 * `user:<user.name>@<host.id>@local`.
 *
 * Mirrors the `entity.namespace == 'local'` branch of
 * `userEntityDefinition.identityField.euidRanking`, but hardcodes the namespace
 * instead of deriving `entity.namespace`.
 */
export function getHostScopedUserEuidEsql(): {
  /** RHS for `| EVAL <col> = …` producing the host-scoped user EUID. */
  evalAssignment: string;
  /** `WHERE` gate requiring every field this EUID composes. */
  presenceGate: string;
} {
  const [userField, hostField] = HOST_SCOPED_USER_FIELDS;

  return {
    evalAssignment: `CONCAT("user:", TO_STRING(\`${userField}\`), "@", TO_STRING(\`${hostField}\`), "@${USER_ENTITY_NAMESPACE.Local}")`,
    presenceGate: HOST_SCOPED_USER_FIELDS.map(esqlRawFieldNonEmpty).join(' AND '),
  };
}

/**
 * Returns an ESQL EVAL fragment for all field evaluations of the given entity type.
 * Use in a pipeline as | EVAL <result>. Returns undefined when there are no field evaluations.
 */
export function getFieldEvaluationsEsqlFromDefinition(
  definition: EntityDefinitionWithoutId
): string | undefined {
  // Use only top-level shared evaluations (e.g. entity.source).
  // Identity-specific evaluations (e.g. entity.namespace) are emitted by
  // getEuidEsqlEvaluation directly, co-located with the EUID expression.
  const evaluations = definition.fieldEvaluations ?? [];
  if (evaluations.length === 0) {
    return undefined;
  }
  return evaluations.map((e) => buildOneFieldEvaluationEsql(e)).join(',\n ');
}

/**
 * Constructs an ESQL filter for the provided entity type that checks if the documents contains an entity id.
 *
 * You will need to prepend the result with a `| WHERE` clause, or just add to your existing WHERE clause.
 *
 * Example usage:
 * ```ts
 * import { getEuidEsqlDocumentsContainsIdFilter } from './esql';
 *
 * const filter = getEuidEsqlDocumentsContainsIdFilter('host');
 * // filter may look like:
 * // '((host.entity.id IS NOT NULL) OR (host.id IS NOT NULL) OR (host.name IS NOT NULL) OR (host.hostname IS NOT NULL))'
 * ```
 *
 * @param entityType - The entity type string (e.g. 'host', 'user', 'generic')
 * @returns An ESQL filter string that checks if the document contains an entity id.
 */
export function getEuidEsqlDocumentsContainsIdFilter(entityType: EntityType) {
  return getEuidEsqlDocumentsContainsIdFilterFromDefinition(
    getEntityDefinitionWithoutId(entityType)
  );
}

/** Same filter for callers that already resolved a definition. */
export function getEuidEsqlDocumentsContainsIdFilterFromDefinition(
  definition: EntityDefinitionWithoutId
) {
  const { identityField } = definition;

  if (isSingleFieldIdentity(identityField)) {
    return `(${esqlIsNotNullOrEmpty(identityField.singleField)})`;
  }

  return conditionToESQL(identityField.documentsFilter);
}

/**
 * Returns a comma-separated ES|QL EVAL assignments fragment that computes the entity id
 * for the given entity type and assigns it to `outputColumn`.
 *
 * For multi-field identities the fragment also emits intermediate columns (`_present`,
 * `_present_or_null`, field-evaluation columns) as sequential assignments in the same
 * `| EVAL` stage so later assignments can reference them by name.
 *
 * Wrap the returned string with `| EVAL`:
 * ```ts
 * parts.push(`| EVAL ${getEuidEsqlEvaluation(type, 'entity.id')}`);
 * ```
 */
export function getEuidEsqlEvaluation(
  entityType: EntityType,
  outputColumn: string,
  { withTypeId = true, options }: { withTypeId?: boolean; options?: EntityDefinitionOptions } = {}
): string {
  const entityDefinition = getEntityDefinitionWithoutId(entityType, undefined, options);
  const { identityField } = entityDefinition;
  const mustPrependTypeId = withTypeId && !identityField.skipTypePrepend;

  if (isSingleFieldIdentity(identityField)) {
    const expression = appendTypeIdIfNeeded(
      entityType,
      castField(identityField.singleField),
      mustPrependTypeId
    );
    return `${outputColumn} = ${expression}`;
  }

  const { euidRanking } = identityField;
  const branches = euidRanking.branches;
  const presentFields = collectRankingFields(branches);
  const presentOrNullAliases = new Map(
    [...presentFields].map((f) => [f, esqlPresentOrNullColumnName(f)])
  );
  const assignments: string[] = [];

  // Identity-specific field evaluations (e.g. entity.namespace for user) must precede
  // the _present columns that may reference their output.
  for (const evaluation of identityField.fieldEvaluations ?? []) {
    assignments.push(buildOneFieldEvaluationEsql(evaluation));
  }
  for (const f of presentFields) {
    assignments.push(`${esqlPresentColumnName(f)} = ${esqlIsNotNullOrEmpty(f)}`);
  }
  // Nullable aliases: field value when present, NULL otherwise.
  for (const f of presentFields) {
    assignments.push(
      `${esqlPresentOrNullColumnName(f)} = CASE(${esqlPresentColumnName(f)}, TO_STRING(${f}))`
    );
  }

  const hasConditionalBranch = branches.some((b) => b.when != null);
  let idLogic: string;
  if (!hasConditionalBranch && branches.length === 1) {
    const ranking = buildRankingCaseEsql(
      branches[0].ranking,
      presentOrNullAliases,
      `_${outputColumn.replace(/[.`]/g, '_')}`
    );
    for (const { colName, esql } of ranking.precomputes) {
      assignments.push(`${colName} = ${esql}`);
    }
    idLogic = ranking.expression;
  } else {
    // Pre-compute each branch's condition and formula as named columns, then pick the first
    // branch whose condition holds with CASE (not COALESCE), so a matched branch that
    // evaluates to NULL does not fall through to the next branch.
    const formulaVars: string[] = [];
    for (const [i, branch] of branches.entries()) {
      const formulaVar = `_euid_branch_${i}_formula`;
      const ranking = buildRankingCaseEsql(branch.ranking, presentOrNullAliases, formulaVar);
      for (const { colName, esql } of ranking.precomputes) {
        assignments.push(`${colName} = ${esql}`);
      }
      assignments.push(`${formulaVar} = ${ranking.expression}`);
      if (branch.when) {
        assignments.push(`_euid_branch_${i}_cond = (${conditionToESQL(branch.when)})`);
      }
      formulaVars.push(formulaVar);
    }
    // `CASE(c0, f0, c1, f1, …, NULL)` as nested single-condition CASEs, one column per level,
    // built from the last branch. A branch without a condition ends the chain, like `TRUE, f`.
    idLogic = 'NULL';
    for (let i = branches.length - 1; i >= 0; i--) {
      if (branches[i].when == null) {
        idLogic = formulaVars[i];
      } else {
        const pickVar = `_euid_branch_${i}_pick`;
        assignments.push(
          `${pickVar} = CASE(_euid_branch_${i}_cond, ${formulaVars[i]}, ${idLogic})`
        );
        idLogic = pickVar;
      }
    }
  }

  assignments.push(
    `${outputColumn} = ${appendTypeIdIfNeeded(entityType, idLogic, mustPrependTypeId)}`
  );
  return assignments.join(',\n ');
}

function appendTypeIdIfNeeded(
  entityType: EntityType,
  euidLogic: string,
  mustPrependTypeId: boolean
) {
  if (mustPrependTypeId) {
    return `CONCAT("${entityType}:", ${euidLogic})`;
  }
  return euidLogic;
}
