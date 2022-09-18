/***
 *
 * Fuzzy Out
 * ===
 * 
 * Randomly renames specified folders in the deployment dir ...
 * - accepts an object, either a directory KV object:
 *     { key: dirname, [...] }
 *   OR an options object:
 *     { dirs: { key: dirname }, verbose: false, dryRun: false }
 * - active mappings are available as env vars "__FUZZY__" and "__{key}_FUZZY__"
 *
 ***/

import { webcrypto } from 'crypto'
import { rename } from 'fs/promises';
import logger from '../../utils/logger';
const { log, warn, error } = logger('plugins', 'fuzzy-out');

const getDir = path =>
  path.replace(/[^/]+$/, '');

export default function VitePluginFuzzyOut(fuzzyDirsOrOptions) {
  const {
    dirs: fuzzyDirs,
    verbose,
    dryRun,
  } = 'dirs' in fuzzyDirsOrOptions
  ? fuzzyDirsOrOptions
  : { dirs: fuzzyDirsOrOptions };

  let root, outDir, basePath;

  const define = {
    __FUZZY__: {}
  };
  for (const [key, dir] of Object.entries(fuzzyDirs)) {
    const uuid = webcrypto.randomUUID();
    define[`__${key}_FUZZY__`] = uuid;
    define.__FUZZY__[dir] = uuid;
  }

  return {
    enforce: 'post',
    name: 'fuzzy-out',
    config: () => ({ define }),
    configResolved(config) {
      root = config.root;
      outDir = config.build.outDir;
      basePath = `${root}/${outDir}/`;
    },
    closeBundle: {
      sequential: true,
      async handler() {
        const fuzzed = new Map();
        const fuzzedError = new Map();
        for (const [dir, fuzzy] of Object.entries(define.__FUZZY__)) {
          try {
            if (!dryRun) {
              await rename(basePath + dir, basePath + fuzzy);
            }
            fuzzed.set(dir, fuzzy);
          } catch (e) {
            fuzzedError.set(`${outDir}/${dir}`, `${outDir}/${fuzzy}`);
          }
        }

        if (fuzzed.size) {
          if (verbose || dryRun) {
            if (dryRun) {
              warn.bind('=== DRY RUN ===')();
            }
            log(
              `sensitive directories have been fuzzed:`,
              fuzzed,
            );
            if (dryRun) {
              warn.bind('=== /DRY RUN ===')();
            }
          } else {
            log('sensitive directories have been fuzzed');
          }
        }

        if (fuzzedError.size) {
          error(
            `could not fuzz sensitive directories - rename manually prior to deployment:`,
            fuzzedError,
          );
        }
      },
    },
  };
}
