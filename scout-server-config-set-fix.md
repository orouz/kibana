# Scout `run-tests --serverConfigSet` propagation fix

## Summary

`scout run-tests` accepts `--serverConfigSet <name>` (inherited from `SERVER_FLAG_OPTIONS`) but the value is parsed and then dropped — never propagated to config loading. Tests always run against the `default` config, regardless of what's passed on the CLI.

`scout start-server` already forwards it correctly. This patch brings `run-tests` in line.

## Repro (before fix)

```
node scripts/scout run-tests \
  --arch serverless \
  --domain security_complete \
  --serverConfigSet cps_local \
  --testFiles <some_spec.ts>
```

`.scout/servers/local.json` is written from `config_sets/default/serverless/...` instead of `config_sets/cps_local/serverless/...`. Any fixture that depends on a non-default config set (e.g. `linkedProject` from `cps_local`) errors with:
`linkedProject fixture is only available in serverless mode with CPS enabled. Use --serverConfigSet cps_local to start servers with a linked cluster.`

## Fix

- `RunTestsOptions`: add `serverConfigSet: string` so the value already returned by `parseTestFlags` (via `...serverOptions`) is part of the public type.
- `runLocalServersAndTests`: pass `options.serverConfigSet` as the third argument to `getConfigRootDir`, matching `startServers` in `src/platform/packages/shared/kbn-scout/src/servers/start_servers.ts`.

No new behavior — just connecting a wire that was already in the harness on the start-server side.

## Diff

```diff
diff --git a/src/platform/packages/shared/kbn-scout/src/playwright/runner/flags.ts b/src/platform/packages/shared/kbn-scout/src/playwright/runner/flags.ts
--- a/src/platform/packages/shared/kbn-scout/src/playwright/runner/flags.ts
+++ b/src/platform/packages/shared/kbn-scout/src/playwright/runner/flags.ts
@@ -25,6 +25,7 @@ export interface RunTestsOptions {
   esFrom: 'serverless' | 'source' | 'snapshot' | undefined;
   installDir: string | undefined;
   logsDir: string | undefined;
+  serverConfigSet: string;
 }

diff --git a/src/platform/packages/shared/kbn-scout/src/playwright/runner/run_tests.ts b/src/platform/packages/shared/kbn-scout/src/playwright/runner/run_tests.ts
--- a/src/platform/packages/shared/kbn-scout/src/playwright/runner/run_tests.ts
+++ b/src/platform/packages/shared/kbn-scout/src/playwright/runner/run_tests.ts
@@ -123,7 +123,11 @@ async function runLocalServersAndTests(
   cmdArgs: string[],
   env: Record<string, string> = {}
 ) {
-  const configRootDir = getConfigRootDir(options.configPath, options.testTarget);
+  const configRootDir = getConfigRootDir(
+    options.configPath,
+    options.testTarget,
+    options.serverConfigSet
+  );
   const config = await loadServersConfig(options.testTarget, log, configRootDir);
   const abortCtrl = new AbortController();
```

## Test plan

- [ ] `node scripts/scout run-tests --arch serverless --domain security_complete --serverConfigSet cps_local --testFiles <any spec that uses the cps_local config>` — verify `.scout/servers/local.json` after the run shows `esServerlessOptions.cps: true` and a `linkedProject` block.
- [ ] Re-run the same command with no `--serverConfigSet`; default config still loads as before.
- [ ] Existing scout suites continue to pass (no behavior change for the default case).

## Why this isn't urgent

CI today never passes `--serverConfigSet` to `run-tests` — non-default configs are exercised via the `test/scout_<name>/` directory-name convention (`detectCustomConfigDir`). The bug is real but no current job triggers it. Fix unlocks the flag-based path so a single test dir can mix default and custom-config specs.

Owner: `kibana-operations`.
