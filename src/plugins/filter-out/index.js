/***
 *
 * Note: this plugin is destructive - it removes files from your outDir, either the
 *       default "/dist" or the one specified in in vite.config.js ... because it
 *       works by exclusion it does not have access to directories above this
 *
 ***/

import { rm } from 'fs/promises';
import { globby } from 'globby';
import logger from '../../utils/logger';
const { log, warn, error } = logger('plugins', 'filter-out');

const getDir = path =>
  path.replace(/[^/]+$/, '');

export default function VitePluginFilterOut(globFilterOrOptions) {
  const {
    filter: globFilter,
    verbose,
    dryRun,
  } = Array.isArray(globFilterOrOptions) || typeof globFilterOrOptions === 'string'
  ? { filter: globFilterOrOptions }
  : globFilterOrOptions;
  let root, outDir, basePath;

  return {
    name: 'filter-out',
    configResolved(config) {
      root = config.root;
      outDir = config.build.outDir;
      basePath = `${root}/${outDir}/`;
    },
    async closeBundle() {
      const filter = [].concat(globFilter).map(path =>
        path.replace(/^([#!])?\/?/, `$1${basePath}`));

      if (!filter.length) {
        return;
      }

      const filesInclude = await globby(filter);
      const pathsInclude = filesInclude.reduce((_, path) =>
        _.add(getDir(path)), new Set());

      const files = await globby(basePath + '**');

      const rmDirs = new Set();
      const rmFiles = new Set();

      for (const file of files) {
        // file is included
        if (filesInclude.includes(file)) {
          continue;
        }

        // file is already excluded via ancestor dir
        if ([...rmDirs].find(dir => file.startsWith(dir))) {
          continue;
        }

        // split file into ancestor directory components
        const fileDir = getDir(file);
        const ancestorDirs = fileDir.slice(basePath.length).split('/');
          
        // iterate over ancestors to see if whole directories can be removed
        let rmDir = basePath;
        for (const ancestor of ancestorDirs) {
          // the final component is always an empty string (dirs end with a slash)
          // if we haven't got a match we should remove the file only
          if (!ancestor) {
            rmDir = null;
            break;
          }

          // concat the next ancestor on with a slash
          rmDir += ancestor + '/';
          // then check if it exists in any include paths
          let parentToIncludedDir;
          for (const path of pathsInclude) {
            if (path.startsWith(rmDir)) {
              parentToIncludedDir = true;
              break;
            }
          }

          // if not a parent to an included dir, remove the entire ancestor dir
          if (!parentToIncludedDir) {
            break;
          }
        }

        // remove ancestor dir or file
        if (rmDir) {
          rmDirs.add(rmDir);
        } else {
          rmFiles.add(file);
        }
      }

      // combine dirs and files, listing dirs first
      const removables = new Set([...rmDirs, ...rmFiles]);


      const removed = [];
      const removedError = [];
      // remove files and dirs, storing the result
      for (const path of removables) {
        const relativePath = path.slice(basePath.length - 1);
        try {
          if (!dryRun) {
            await rm(path, { recursive: true });
          }
          removed.push(relativePath);
        } catch (e) {
          removedError.push(relativePath);
        }
      }

      // describe what was removed
      if (removed.length) {
        if (verbose || dryRun) {
          if (dryRun) {
            warn.bind('=== DRY RUN ===')();
          }
          log(
            `Files not suitable for deployment have been removed from the "${outDir}/" directory:`,
            removed,
          );
          if (dryRun) {
            warn.bind('=== /DRY RUN ===')();
          }
        } else {
          log('deployment directory has been filtered');
        }
      }

      // describe anything that needs to be manually removed
      if (removedError.length) {
        warn(
          `Consider manually removing the following files from "${outDir}/" prior to deployment:`,
          removedError,
        );
      }      
    },
  };
}
