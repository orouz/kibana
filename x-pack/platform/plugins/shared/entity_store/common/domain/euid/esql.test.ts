/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  getEuidEsqlEvaluation,
  getEuidEsqlDocumentsContainsIdFilter,
  getEuidEsqlFilterBasedOnDocument,
  getFieldEvaluationsEsql,
  getFieldEvaluationsEsqlFromDefinition,
  collectRankingFields,
  buildRankingCaseEsql,
  buildSourcePickerEsql,
  buildDestinationFieldEsql,
  buildOneFieldEvaluationEsql,
  getHostScopedUserEuidEsql,
} from './esql';
import { Parser, Walker } from '@elastic/esql';
import type { ESQLAstItem, ESQLFunction } from '@elastic/esql/types';
import type {
  EuidRankingBranch,
  FieldEvaluation,
  FieldEvaluationWhenClause,
} from '../definitions/entity_schema';
import { isSingleFieldIdentity } from '../definitions/entity_schema';
import { getEntityDefinition } from '../definitions/registry';
import { userEntityDefinition } from '../definitions/user';

const normalize = (s: string) =>
  s
    .split(/\n/)
    .map((line) => line.replace(/\s{2,}/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');

describe('getEuidEsqlFilterBasedOnDocument', () => {
  it('returns undefined when doc is falsy', () => {
    expect(getEuidEsqlFilterBasedOnDocument('host', null)).toBeUndefined();
    expect(getEuidEsqlFilterBasedOnDocument('generic', undefined)).toBeUndefined();
    expect(getEuidEsqlFilterBasedOnDocument('user', {})).toBeUndefined();
  });

  describe('generic', () => {
    it('returns ESQL filter with equality on entity.id when present', () => {
      const result = getEuidEsqlFilterBasedOnDocument('generic', { entity: { id: 'e-123' } });

      expect(result).toBe('(entity.id == "e-123")');
    });

    it('unwraps _source when doc is an Elasticsearch hit', () => {
      const result = getEuidEsqlFilterBasedOnDocument('generic', {
        _source: { entity: { id: 'e-123' } },
      });

      expect(result).toBe('(entity.id == "e-123")');
    });
  });

  describe('host', () => {
    it('returns filter with equality on host.id when present', () => {
      const result = getEuidEsqlFilterBasedOnDocument('host', {
        host: { name: 'to-be-ignored', id: 'host-id-1' },
      });

      expect(result).toBe('((host.id == "host-id-1"))');
    });

    it('returns filter with equality on host.name and null/empty check on host.id when host.id is missing', () => {
      const result = getEuidEsqlFilterBasedOnDocument('host', { host: { name: 'server1' } });

      expect(result).toBe(
        '((host.name == "server1") AND (TO_STRING(host.id) IS NULL OR TO_STRING(host.id) == ""))'
      );
    });

    it('returns filter with equality on host.hostname and null/empty checks when only host.hostname is present', () => {
      const result = getEuidEsqlFilterBasedOnDocument('host', { host: { hostname: 'node-1' } });

      expect(result).toBe(
        '((host.hostname == "node-1") AND (TO_STRING(host.id) IS NULL OR TO_STRING(host.id) == "") AND (TO_STRING(host.name) IS NULL OR TO_STRING(host.name) == ""))'
      );
    });

    it('precedence: uses host.id when both host.id and host.name are present', () => {
      const result = getEuidEsqlFilterBasedOnDocument('host', {
        host: { id: 'e1', name: 'myserver' },
      });

      expect(result).toBe('((host.id == "e1"))');
    });
  });

  describe('user', () => {
    it('returns filter with user.email and source clause when event.module is present (whenClause expands to sourceMatchesAny)', () => {
      const result = getEuidEsqlFilterBasedOnDocument('user', {
        user: { email: 'alice@example.com' },
        event: { kind: 'asset', module: 'okta' },
      });

      expect(result).toBe(
        '((user.email == "alice@example.com") AND (((event.module == "okta") OR STARTS_WITH(data_stream.dataset, "okta")) OR ((event.module == "entityanalytics_okta") OR STARTS_WITH(data_stream.dataset, "entityanalytics_okta"))))'
      );
    });

    it('returns filter with user.email and unknown source clause when no event.module or data_stream.dataset', () => {
      const result = getEuidEsqlFilterBasedOnDocument('user', {
        user: { email: 'alice@example.com' },
        event: { kind: 'asset' },
      });

      expect(result).toBe(
        '((user.email == "alice@example.com") AND ((TO_STRING(event.module) IS NULL OR TO_STRING(event.module) == "") AND (TO_STRING(data_stream.dataset) IS NULL OR TO_STRING(data_stream.dataset) == "")))'
      );
    });

    it('returns filter with user.name and source clause (event.module whenClause) and null/empty checks on higher-ranked identity fields', () => {
      const result = getEuidEsqlFilterBasedOnDocument('user', {
        user: { name: 'alice' },
        event: { kind: 'asset', module: 'azure' },
      });

      expect(result).toBe(
        '((user.name == "alice") AND (TO_STRING(user.email) IS NULL OR TO_STRING(user.email) == "") AND (TO_STRING(user.id) IS NULL OR TO_STRING(user.id) == "") AND (TO_STRING(user.domain) IS NULL OR TO_STRING(user.domain) == "") AND (((event.module == "azure") OR STARTS_WITH(data_stream.dataset, "azure")) OR ((event.module == "entityanalytics_entra_id") OR STARTS_WITH(data_stream.dataset, "entityanalytics_entra_id"))))'
      );
    });

    it('returns undefined when doc passes documentsFilter but fails postAggFilter (no asset kind, no local namespace, no entity.id)', () => {
      expect(
        getEuidEsqlFilterBasedOnDocument('user', {
          user: { id: 'user-id-42' },
          event: { module: 'o365' },
        })
      ).toBeUndefined();
    });

    it('returns undefined when no user id fields are present', () => {
      expect(getEuidEsqlFilterBasedOnDocument('user', {})).toBeUndefined();
    });

    it('precedence: uses user.email and source clause when both user.email and user.id are present', () => {
      const result = getEuidEsqlFilterBasedOnDocument('user', {
        user: { email: 'alice@example.com', id: 'user-42' },
        event: { kind: 'asset', module: 'entityanalytics_okta' },
      });

      expect(result).toBe(
        '((user.email == "alice@example.com") AND (((event.module == "okta") OR STARTS_WITH(data_stream.dataset, "okta")) OR ((event.module == "entityanalytics_okta") OR STARTS_WITH(data_stream.dataset, "entityanalytics_okta"))))'
      );
    });

    it('returns filter for user.name and user.domain with source clause (single value from whenClause)', () => {
      const result = getEuidEsqlFilterBasedOnDocument('user', {
        user: { name: 'jane', domain: 'corp.com' },
        event: { kind: 'asset', module: 'entityanalytics_ad' },
      });

      expect(result).toBe(
        '((user.name == "jane") AND (user.domain == "corp.com") AND (TO_STRING(user.email) IS NULL OR TO_STRING(user.email) == "") AND (TO_STRING(user.id) IS NULL OR TO_STRING(user.id) == "") AND ((event.module == "entityanalytics_ad") OR STARTS_WITH(data_stream.dataset, "entityanalytics_ad")))'
      );
    });

    it('returns filter with single value source clause when event.module has no whenClause match (e.g. aws)', () => {
      const result = getEuidEsqlFilterBasedOnDocument('user', {
        user: { email: 'romulo@elastic.co' },
        event: { kind: 'asset', module: 'aws' },
      });

      expect(result).toBe(
        '((user.email == "romulo@elastic.co") AND ((event.module == "aws") OR STARTS_WITH(data_stream.dataset, "aws")))'
      );
    });

    it('returns filter with source clause from first chunk of data_stream.dataset when event.module is missing', () => {
      const result = getEuidEsqlFilterBasedOnDocument('user', {
        user: { email: 'romulo@elastic.co' },
        event: { kind: 'asset' },
        data_stream: { dataset: 'aws.cloudtrail' },
      });

      expect(result).toBe(
        '((user.email == "romulo@elastic.co") AND ((event.module == "aws") OR STARTS_WITH(data_stream.dataset, "aws")))'
      );
    });
  });

  describe('service', () => {
    it('returns undefined when service.name is missing (single-field identity)', () => {
      const result = getEuidEsqlFilterBasedOnDocument('service', {
        service: { entity: { id: 'svc-entity-1' } },
      });

      expect(result).toBeUndefined();
    });

    it('returns filter with equality on service.name (single-field identity)', () => {
      const result = getEuidEsqlFilterBasedOnDocument('service', {
        service: { name: 'api-gateway' },
      });

      expect(result).toBe('(service.name == "api-gateway")');
    });

    it('uses service.name when both service.entity.id and service.name are present (single-field identity)', () => {
      const result = getEuidEsqlFilterBasedOnDocument('service', {
        service: { entity: { id: 'svc-e1' }, name: 'api-gateway' },
      });

      expect(result).toBe('(service.name == "api-gateway")');
    });
  });
});

describe('getEuidEsqlDocumentsContainsIdFilter', () => {
  it('returns single field condition for generic (one required field)', () => {
    const result = getEuidEsqlDocumentsContainsIdFilter('generic');

    expect(result).toBe('(TO_STRING(entity.id) IS NOT NULL AND TO_STRING(entity.id) != "")');
  });

  it('returns OR of required fields for host', () => {
    const result = getEuidEsqlDocumentsContainsIdFilter('host');

    const expected =
      'TO_STRING(host.id) IS NOT NULL AND TO_STRING(host.id) != "" OR TO_STRING(host.name) IS NOT NULL AND TO_STRING(host.name) != "" OR TO_STRING(host.hostname) IS NOT NULL AND TO_STRING(host.hostname) != ""';
    expect(result).toBe(expected);
  });

  it('returns documents filter AND postAggFilter for user (IDP or non-IDP only)', () => {
    const result = getEuidEsqlDocumentsContainsIdFilter('user');

    expect(result).toMatchSnapshot();
  });
});

describe('getFieldEvaluationsEsql', () => {
  it.each(['generic', 'host', 'service'] as const)(
    'returns shared entity.source EVAL fragment for %s',
    (entityType) => {
      const result = getFieldEvaluationsEsql(entityType);

      expect(result).toContain('_src_entity_source0 = MV_FIRST(TO_STRING(event.module))');
      expect(result).toContain('_src_entity_source1 = MV_FIRST(TO_STRING(event.dataset))');
      expect(result).toContain('_src_entity_source2 = MV_FIRST(TO_STRING(data_stream.dataset))');
      // Multi-source picker uses COALESCE of single-arm CaseEagerEvaluators
      expect(result).toContain('_src_entity_source = COALESCE(');
      // entity.source has no whenClauses -> 2-arm CASE (already CaseEagerEvaluator)
      expect(result).toContain('entity.source = CASE(');
      expect(result).toContain('_src_entity_source)');
    }
  );

  it('returns only entity.source for user (entity.namespace is now in getEuidEsqlEvaluation)', () => {
    const result = getFieldEvaluationsEsqlFromDefinition(getEntityDefinition('user', 'default'));

    expect(result).toBeDefined();
    // entity.source has no whenClauses -> 2-arm CASE (already CaseEagerEvaluator)
    expect(result).toContain('entity.source = CASE(');
    // entity.namespace is now emitted by getEuidEsqlEvaluation, not here
    expect(result).not.toContain('entity.namespace');
    expect(result).not.toContain('entity.confidence');
  });

  it('getEuidEsqlEvaluation includes entity.namespace for user', () => {
    const result = getEuidEsqlEvaluation('user', 'entity.id');

    // Destination now uses COALESCE of single-arm CaseEagerEvaluators
    expect(result).toContain('entity.namespace = COALESCE(');
    expect(result).toContain('_src_entity_namespace');
    expect(result).toContain('"local"');
    expect(result).toContain('"unknown"');
    // namespace computed before the _present booleans that reference it
    const namespacePos = result.indexOf('entity.namespace =');
    const presentPos = result.indexOf('entity_namespace_present =');
    expect(namespacePos).toBeLessThan(presentPos);
  });
});

describe('getEuidEsqlEvaluation', () => {
  it('returns bare assignment for single-field identity (generic)', () => {
    const result = getEuidEsqlEvaluation('generic', 'entity.id');

    expect(normalize(result)).toBe('entity.id = TO_STRING(entity.id)');
  });

  it('returns bare assignment for single-field identity (service)', () => {
    const result = getEuidEsqlEvaluation('service', 'entity.id');

    expect(normalize(result)).toBe(`entity.id = CONCAT("service:", TO_STRING(service.name))`);
  });

  it('returns _present booleans followed by output assignment for host', () => {
    const result = getEuidEsqlEvaluation('host', 'entity.id');

    expect(result).toContain(
      'host_id_present = TO_STRING(host.id) IS NOT NULL AND TO_STRING(host.id) != ""'
    );
    expect(result).toContain('host_name_present =');
    expect(result).toContain('host_hostname_present =');
    expect(result).toContain('host_id_present');
    expect(result).not.toMatch(/entity\.id.*IS NOT NULL AND/);
    expect(result).toContain('TO_STRING(host.id)');
    expect(result).toMatch(/entity\.id\s*=\s*CONCAT/);
  });

  it('returns _present booleans for all user identity fields', () => {
    const result = getEuidEsqlEvaluation('user', 'entity.id');

    expect(result).toContain('entity_namespace_present =');
    expect(result).toContain('user_email_present =');
    expect(result).toContain('user_id_present =');
    expect(result).toContain('user_name_present =');
    expect(result).not.toMatch(/entity\.id.*IS NOT NULL AND/);
  });

  it('honours the outputColumn parameter', () => {
    const result = getEuidEsqlEvaluation('host', 'my_custom_euid');

    expect(result).toContain('my_custom_euid =');
    expect(result).not.toContain('entity.id =');
  });
});

describe('getEuidEsqlFilterBasedOnDocument user local namespace', () => {
  it('uses user.name@host.id@entity.namespace when fieldEvaluations set entity.namespace to local', () => {
    const result = getEuidEsqlFilterBasedOnDocument('user', {
      user: { name: 'alice' },
      host: { id: 'host-1' },
      event: { category: 'authentication' },
    });

    expect(result).toContain('user.name == "alice"');
    expect(result).toContain('host.id == "host-1"');
  });

  it('uses else ranking when entity.namespace is not local', () => {
    const result = getEuidEsqlFilterBasedOnDocument('user', {
      user: { email: 'alice@example.com' },
      event: { kind: 'asset', module: 'okta' },
    });

    expect(result).toContain('user.email == "alice@example.com"');
    expect(result).not.toContain('host.id');
  });

  describe('evaluated fields and source clauses', () => {
    it('does not add filter on evaluated fields (entity.namespace) since they are not stored', () => {
      const result = getEuidEsqlFilterBasedOnDocument('user', {
        user: { email: 'alice@example.com' },
        event: { kind: 'asset', module: 'okta' },
      });

      expect(result).toBeDefined();
      expect(result).not.toMatch(/entity\.namespace\s*==/);
      expect(result).not.toMatch(/entity\.confidence\s*==/);
    });

    it('includes source clause for entity.namespace evaluation (event.module, data_stream.dataset)', () => {
      const result = getEuidEsqlFilterBasedOnDocument('user', {
        user: { name: 'jane', domain: 'corp.com' },
        event: { kind: 'asset', module: 'entityanalytics_ad' },
      });

      expect(result).toBeDefined();
      expect(result).toContain('event.module');
      expect(result).toContain('data_stream.dataset');
      expect(result).not.toMatch(/entity\.namespace\s*==/);
      expect(result).not.toMatch(/entity\.confidence\s*==/);
    });
  });
});

// ---------------------------------------------------------------------------
// Builder helpers (unit-level documentation tests)
// ---------------------------------------------------------------------------

describe('collectRankingFields', () => {
  it('returns an empty set for a single-arm single-field branch (no _present columns needed)', () => {
    const branches: EuidRankingBranch[] = [{ ranking: [[{ field: 'service.name' }]] }];

    expect(collectRankingFields(branches)).toEqual(new Set());
  });

  it('returns all fields for a multi-arm branch', () => {
    const branches: EuidRankingBranch[] = [
      { ranking: [[{ field: 'host.id' }], [{ field: 'host.name' }], [{ field: 'host.hostname' }]] },
    ];

    expect(collectRankingFields(branches)).toEqual(
      new Set(['host.id', 'host.name', 'host.hostname'])
    );
  });

  it('extracts only EuidFields from composed arms, excluding separators', () => {
    const branches: EuidRankingBranch[] = [
      { ranking: [[{ field: 'user.name' }, { sep: '@' }, { field: 'host.id' }]] },
    ];

    expect(collectRankingFields(branches)).toEqual(new Set(['user.name', 'host.id']));
  });

  it('collects fields across multiple branches', () => {
    const branches: EuidRankingBranch[] = [
      { ranking: [[{ field: 'user.name' }, { sep: '@' }, { field: 'host.id' }]] },
      { ranking: [[{ field: 'user.email' }], [{ field: 'user.name' }]] },
    ];

    expect(collectRankingFields(branches)).toEqual(new Set(['user.name', 'host.id', 'user.email']));
  });
});

describe('buildRankingCaseEsql', () => {
  it('returns a bare _present_or_null column ref for a single-arm single-field ranking', () => {
    const ranking = [[{ field: 'host.id' }]];
    const aliases = new Map([['host.id', 'host_id_present_or_null']]);

    expect(buildRankingCaseEsql(ranking, aliases, '_euid')).toEqual({
      expression: 'host_id_present_or_null',
      precomputes: [],
    });
  });

  it('falls back to TO_STRING(<field>) when the field is not in the alias map', () => {
    const ranking = [[{ field: 'host.id' }]];

    expect(buildRankingCaseEsql(ranking, new Map(), '_euid').expression).toBe('TO_STRING(host.id)');
  });

  it('returns CONCAT for a single composed arm (NULL when any component is absent)', () => {
    const ranking = [[{ field: 'user.name' }, { sep: '@' }, { field: 'host.id' }]];
    const aliases = new Map([
      ['user.name', 'user_name_present_or_null'],
      ['host.id', 'host_id_present_or_null'],
    ]);

    expect(buildRankingCaseEsql(ranking, aliases, '_euid')).toEqual({
      expression: 'CONCAT(user_name_present_or_null, "@", host_id_present_or_null)',
      precomputes: [],
    });
  });

  it('returns COALESCE of arm columns for a multi-arm ranking, preserving priority order', () => {
    const ranking = [
      [{ field: 'host.id' }],
      [{ field: 'host.name' }],
      [{ field: 'host.hostname' }],
    ];
    const aliases = new Map([
      ['host.id', 'host_id_present_or_null'],
      ['host.name', 'host_name_present_or_null'],
      ['host.hostname', 'host_hostname_present_or_null'],
    ]);

    expect(buildRankingCaseEsql(ranking, aliases, '_euid')).toEqual({
      expression: 'COALESCE(_euid_arm0, _euid_arm1, _euid_arm2)',
      precomputes: [
        { colName: '_euid_arm0', esql: 'host_id_present_or_null' },
        { colName: '_euid_arm1', esql: 'host_name_present_or_null' },
        { colName: '_euid_arm2', esql: 'host_hostname_present_or_null' },
      ],
    });
  });

  it('throws on an empty ranking', () => {
    expect(() => buildRankingCaseEsql([], new Map(), '_euid')).toThrow('No euid fields found');
  });

  it('throws when a single arm starts with a separator', () => {
    expect(() => buildRankingCaseEsql([[{ sep: '@' }]], new Map(), '_euid')).toThrow(
      'Separator found in single field'
    );
  });
});

describe('buildSourcePickerEsql', () => {
  it('returns a COALESCE over one single-arm CASE column per source variable', () => {
    expect(buildSourcePickerEsql('_src_entity_source', 2)).toEqual({
      expression: 'COALESCE(_src_entity_source0_value, _src_entity_source1_value)',
      precomputes: [
        {
          colName: '_src_entity_source0_value',
          esql: 'CASE(_src_entity_source0 IS NOT NULL AND _src_entity_source0 != "", _src_entity_source0)',
        },
        {
          colName: '_src_entity_source1_value',
          esql: 'CASE(_src_entity_source1 IS NOT NULL AND _src_entity_source1 != "", _src_entity_source1)',
        },
      ],
    });
  });

  it('works for count=1 (degenerate single-arm COALESCE)', () => {
    expect(buildSourcePickerEsql('_src', 1)).toEqual({
      expression: 'COALESCE(_src0_value)',
      precomputes: [
        { colName: '_src0_value', esql: 'CASE(_src0 IS NOT NULL AND _src0 != "", _src0)' },
      ],
    });
  });

  it('throws for count=0 (would produce invalid COALESCE())', () => {
    expect(() => buildSourcePickerEsql('_src', 0)).toThrow(
      'buildSourcePickerEsql requires at least one source variable'
    );
  });
});

describe('buildDestinationFieldEsql', () => {
  it('no whenClauses -> simple 2-arm CASE (fallback then pass-through)', () => {
    const { expression, conditionPrecomputes } = buildDestinationFieldEsql(
      '_src',
      '_eval_dest',
      '"default"',
      []
    );

    expect(conditionPrecomputes).toEqual([]);
    expect(expression).toBe('CASE(_src IS NULL OR _src == "", "default", _src)');
  });

  it('sourceMatchesAny whenClause -> COALESCE over an IN-list arm column and the fallback column', () => {
    const { expression, conditionPrecomputes } = buildDestinationFieldEsql(
      '_src',
      '_eval_dest',
      '"unknown"',
      [{ sourceMatchesAny: ['okta', 'entityanalytics_okta'], then: 'okta' }]
    );

    expect(conditionPrecomputes).toEqual([
      {
        colName: '_eval_dest_then0',
        esql: 'CASE(_src IN ("okta", "entityanalytics_okta"), "okta")',
      },
      { colName: '_eval_dest_fallback', esql: 'CASE(_src IS NULL OR _src == "", "unknown")' },
    ]);
    expect(expression).toBe('COALESCE(_eval_dest_then0, _eval_dest_fallback, _src)');
  });

  it('condition whenClause -> a condition column, an arm column that reads it, and the fallback column', () => {
    const { expression, conditionPrecomputes } = buildDestinationFieldEsql(
      '_src',
      '_eval_dest',
      '"unknown"',
      [{ condition: { field: 'event.kind', eq: 'asset' }, then: 'local' }]
    );

    expect(conditionPrecomputes).toEqual([
      { colName: '_eval_dest_arm0', esql: '(TO_STRING(event.kind) == "asset")' },
      { colName: '_eval_dest_then0', esql: 'CASE(_eval_dest_arm0, "local")' },
      { colName: '_eval_dest_fallback', esql: 'CASE(_src IS NULL OR _src == "", "unknown")' },
    ]);
    expect(expression).toBe('COALESCE(_eval_dest_then0, _eval_dest_fallback, _src)');
  });

  describe('field-mapping then', () => {
    // Use the real user definition as source of truth so this block stays in sync
    // with user.ts automatically — no duplicate manual copy to drift.
    const { identityField } = userEntityDefinition;
    if (isSingleFieldIdentity(identityField)) throw new Error('expected multi-field identity');
    const { fieldEvaluations } = identityField;
    if (!fieldEvaluations?.length) throw new Error('expected fieldEvaluations');
    const cloudProviderClause = fieldEvaluations[0].whenClauses[1] as FieldEvaluationWhenClause & {
      condition: object;
      then: { field: string; mapping: Record<string, string> };
    };

    it('emits a condition column, one column per mapping entry, and an arm column', () => {
      const { expression, conditionPrecomputes } = buildDestinationFieldEsql(
        '_src',
        '_eval_dest',
        '"unknown"',
        [cloudProviderClause]
      );
      const byName = new Map(conditionPrecomputes.map(({ colName, esql }) => [colName, esql]));

      // The precomputed condition covers both fields from the real user.ts compound condition.
      expect(byName.get('_eval_dest_arm0')).toContain('event.kind');
      expect(byName.get('_eval_dest_arm0')).toContain('asset_discovery');

      // The mapping reads cloud.provider once, maps it with one single-condition CASE per
      // entry, and combines the entries. When the condition holds but cloud.provider is
      // absent or not in the mapping, the mapping is NULL → COALESCE falls through.
      expect(byName.get('_eval_dest_map0_value')).toBe('MV_FIRST(TO_STRING(cloud.provider))');
      expect(byName.get('_eval_dest_map0_0')).toBe('CASE(_eval_dest_map0_value == "aws", "aws")');
      expect(byName.get('_eval_dest_map0_1')).toBe('CASE(_eval_dest_map0_value == "gcp", "gcp")');
      expect(byName.get('_eval_dest_map0_2')).toBe(
        'CASE(_eval_dest_map0_value == "azure", "entra_id")'
      );
      expect(byName.get('_eval_dest_map0')).toBe(
        'COALESCE(_eval_dest_map0_0, _eval_dest_map0_1, _eval_dest_map0_2)'
      );
      expect(byName.get('_eval_dest_then0')).toBe('CASE(_eval_dest_arm0, _eval_dest_map0)');
      expect(expression).toBe('COALESCE(_eval_dest_then0, _eval_dest_fallback, _src)');
    });

    it('mapping has no fallback entry so unmapped values produce NULL (fall-through)', () => {
      // The mapping has exactly 3 explicit value→namespace entries and no catch-all.
      // An unmapped provider (e.g. "ibm") or absent cloud.provider yields NULL,
      // which causes the outer COALESCE to try the next arm instead of assigning a namespace.
      const { conditionPrecomputes } = buildDestinationFieldEsql(
        '_src',
        '_eval_dest',
        '"unknown"',
        [cloudProviderClause]
      );
      const mappingEntries = conditionPrecomputes.filter(({ colName }) =>
        /^_eval_dest_map0_\d+$/.test(colName)
      );

      expect(mappingEntries).toHaveLength(3);
      expect(conditionPrecomputes.map(({ esql }) => esql).join('\n')).not.toContain('"ibm"');
    });
  });
});

describe('buildOneFieldEvaluationEsql', () => {
  it('single source, no whenClauses -> one source assignment then destination CASE', () => {
    const evaluation: FieldEvaluation = {
      destination: 'entity.source',
      sources: [{ field: 'event.module' }],
      fallbackValue: null,
      whenClauses: [],
    };

    const result = normalize(buildOneFieldEvaluationEsql(evaluation));

    expect(result).toBe(
      '_src_entity_source = MV_FIRST(TO_STRING(event.module)),\n' +
        'entity.source = CASE(_src_entity_source IS NULL OR _src_entity_source == "", NULL, _src_entity_source)'
    );
  });

  it('multiple sources -> per-source numbered assignments, a picker, then destination', () => {
    const evaluation: FieldEvaluation = {
      destination: 'entity.namespace',
      sources: [
        { field: 'event.module' },
        { firstChunkOfField: 'data_stream.dataset', splitBy: '.' },
      ],
      fallbackValue: 'unknown',
      whenClauses: [],
    };

    const result = normalize(buildOneFieldEvaluationEsql(evaluation));

    expect(result).toContain('_src_entity_namespace0 = MV_FIRST(TO_STRING(event.module))');
    expect(result).toContain(
      '_src_entity_namespace1 = MV_FIRST(SPLIT(MV_FIRST(TO_STRING(data_stream.dataset)), "."))'
    );
    expect(result).toContain(
      '_src_entity_namespace0_value = CASE(_src_entity_namespace0 IS NOT NULL'
    );
    expect(result).toContain(
      '_src_entity_namespace = COALESCE(_src_entity_namespace0_value, _src_entity_namespace1_value)'
    );
    expect(result).toContain('entity.namespace = CASE(_src_entity_namespace IS NULL');
  });

  it('condition whenClause -> precompute boolean column appears before destination assignment', () => {
    const evaluation: FieldEvaluation = {
      destination: 'entity.namespace',
      sources: [{ field: 'event.module' }],
      fallbackValue: 'unknown',
      whenClauses: [{ condition: { field: 'event.kind', eq: 'asset' }, then: 'local' }],
    };

    const result = normalize(buildOneFieldEvaluationEsql(evaluation));
    const precomputePos = result.indexOf(
      '_eval_entity_namespace_arm0 = (TO_STRING(event.kind) == "asset")'
    );
    const destinationPos = result.indexOf('entity.namespace = COALESCE(');

    expect(precomputePos).toBeGreaterThan(-1);
    expect(destinationPos).toBeGreaterThan(precomputePos);
  });

  it('throws when sources is empty', () => {
    const evaluation: FieldEvaluation = {
      destination: 'entity.source',
      sources: [],
      fallbackValue: null,
      whenClauses: [],
    };

    expect(() => buildOneFieldEvaluationEsql(evaluation)).toThrow(
      'buildOneFieldEvaluationEsql: field evaluation "entity.source" has no sources'
    );
  });
});

describe('getHostScopedUserEuidEsql', () => {
  describe('evalAssignment', () => {
    it('emits the canonical user:<user.name>@<host.id>@local EUID', () => {
      const { evalAssignment } = getHostScopedUserEuidEsql();

      expect(evalAssignment).toBe(
        'CONCAT("user:", TO_STRING(`user.name`), "@", TO_STRING(`host.id`), "@local")'
      );
    });

    it('never falls back to user.email — that would reference an IDP EUID', () => {
      const { evalAssignment } = getHostScopedUserEuidEsql();

      // The host-scoped ranking branch has a single arm gated on user.name being
      // non-empty, so a fallback could only fire for documents extraction classifies
      // as IDP users. Emitting `user:alice@corp.com@h1@local` would reference an EUID
      // that does not exist in the store and 404 on every write.
      expect(evalAssignment).not.toContain('user.email');
      expect(evalAssignment).not.toContain('COALESCE');
    });

    it('keeps host.id and the @local namespace in the canonical positions', () => {
      const { evalAssignment } = getHostScopedUserEuidEsql();

      expect(evalAssignment.indexOf('`user.name`')).toBeLessThan(
        evalAssignment.indexOf('`host.id`')
      );
      expect(evalAssignment.endsWith('"@local")')).toBe(true);
    });

    it('emits no entity.namespace derivation chain', () => {
      const { evalAssignment } = getHostScopedUserEuidEsql();

      // The whole point of this helper: skip the namespace/EUID EVAL chain.
      expect(evalAssignment).not.toContain('entity.namespace');
      expect(evalAssignment).not.toContain('CASE(');
      expect(evalAssignment).not.toContain('MV_FIRST');
    });

    it('matches the host-scoped branch of the user entity definition euidRanking', () => {
      // Guards against the definition drifting away from what this helper emits.
      const { identityField } = userEntityDefinition;
      if (isSingleFieldIdentity(identityField)) {
        throw new Error('expected userEntityDefinition to use euidRanking');
      }
      const hostScopedBranch = identityField.euidRanking.branches[0];

      // Exactly one arm — this is what makes emitting user.name with no COALESCE
      // fallback correct. A second arm would mean the EUID has alternatives that
      // this helper is silently ignoring.
      expect(hostScopedBranch.ranking).toHaveLength(1);
      expect(hostScopedBranch.when).toEqual({ field: 'entity.namespace', eq: 'local' });

      const hostScopedBranchFields = hostScopedBranch.ranking[0]
        .filter((attr): attr is { field: string } => 'field' in attr)
        .map((attr) => attr.field);

      expect(hostScopedBranchFields).toEqual(['user.name', 'host.id', 'entity.namespace']);
    });
  });

  describe('presenceGate', () => {
    it('requires every field the EUID composes, AND-joined', () => {
      const { presenceGate } = getHostScopedUserEuidEsql();

      // Both fields are mandatory — a document missing either is an IDP user that
      // extraction indexed under a different EUID, so admitting it would build an id
      // the entity store does not hold.
      expect(presenceGate).toBe(
        '(`user.name` IS NOT NULL AND `user.name` != "") AND (`host.id` IS NOT NULL AND `host.id` != "")'
      );
    });

    it('gates on exactly the fields the EUID reads', () => {
      const { evalAssignment, presenceGate } = getHostScopedUserEuidEsql();

      for (const field of ['user.name', 'host.id']) {
        expect(evalAssignment).toContain(`\`${field}\``);
        expect(presenceGate).toContain(`\`${field}\``);
      }
      // user.email belongs to the IDP ranking branch, not this one.
      expect(presenceGate).not.toContain('user.email');
    });
  });
});

// ---------------------------------------------------------------------------
// Evaluation shape: keeps ES|QL on its page-at-a-time evaluators
// ---------------------------------------------------------------------------

/** A column, a literal, or `TO_STRING` of a column (the `_present_or_null` aliases). */
const isColumnOrLiteral = (node: ESQLAstItem): boolean => {
  if (Array.isArray(node)) return false;
  if (node.type === 'column' || node.type === 'literal') return true;
  return (
    node.type === 'function' &&
    node.name === 'to_string' &&
    node.args.length === 1 &&
    !Array.isArray(node.args[0]) &&
    node.args[0].type === 'column'
  );
};

/** Every CASE and COALESCE call in an EVAL fragment. */
const getConditionalCalls = (evalFragment: string): ESQLFunction[] => {
  const { root, errors } = Parser.parse(`FROM logs | EVAL ${evalFragment}`);
  expect(errors).toEqual([]);
  return Walker.findAll(
    root,
    (node) => node.type === 'function' && (node.name === 'case' || node.name === 'coalesce')
  ) as ESQLFunction[];
};

describe('generated CASE and COALESCE expressions', () => {
  const fragments = (['generic', 'host', 'user', 'service'] as const).flatMap((entityType) => [
    [`getEuidEsqlEvaluation(${entityType})`, getEuidEsqlEvaluation(entityType, 'entity.id')],
    [`getFieldEvaluationsEsql(${entityType})`, getFieldEvaluationsEsql(entityType)],
  ]);

  it.each(fragments)('%s gives CASE a single condition', (_, esql) => {
    for (const { name, args } of getConditionalCalls(esql ?? 'x = 1')) {
      if (name === 'case') expect(args.length).toBeLessThanOrEqual(3);
    }
  });

  it.each(fragments)('%s passes only columns and literals as values', (_, esql) => {
    for (const { name, args, text } of getConditionalCalls(esql ?? 'x = 1')) {
      // A CASE condition may be any boolean expression; its values and every COALESCE
      // argument must be columns or literals.
      const values = name === 'case' ? args.slice(1) : args;
      expect({ call: text, allColumnsOrLiterals: values.every(isColumnOrLiteral) }).toEqual({
        call: text,
        allColumnsOrLiterals: true,
      });
    }
  });
});
