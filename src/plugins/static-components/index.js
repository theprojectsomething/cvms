import { readFile, writeFile } from 'fs/promises';
import { globby } from 'globby';
import { renderStaticComponents } from './static'
import logger from '../../utils/logger';
const { error } = logger('plugins', 'static-components');

const getTemplate = async path =>
  await readFile(path, 'utf8').catch(e => {})

export default function VitePluginStaticComponents() {
  let root, outDir;
  
  return {
    name: 'static-components',
    configResolved(config) {
      root = config.root;
      outDir = config.build.outDir;
    },
    async closeBundle() {
      const list = await globby(`${root}/${outDir}/**/*.html`);

      const waiting = [];
      for (const path of list) {
        const rendered = readFile(path, 'utf8')
        .then(html => renderStaticComponents(html, path, getTemplate, null, root, true))
        .then(html => writeFile(path, html));
        waiting.push(rendered);
      }
      await Promise.all(waiting);
    },
  };
}
