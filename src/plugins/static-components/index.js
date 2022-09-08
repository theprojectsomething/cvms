import { readFile, writeFile } from 'fs/promises';
import { globby } from 'globby';
import { renderStaticComponents, renderSlotRegEx, resolvePath } from './static'
import logger from '../../utils/logger';
const { error } = logger('plugins', 'static-components');

export async function renderAsyncStaticComponents(html, path, root) {
  const waiting = [];
  html.replace(renderSlotRegEx, (...args) => {
    const waitfor = new Promise(async (resolve) => {
      const [,prefix='',,href] = args;
      const templatePath = href[0] === '/' ? root + href : resolvePath(path, href);
      const template = await readFile(templatePath, 'utf8').catch(e => {});
      if (template) {
        const subrender = await renderAsyncStaticComponents(template, templatePath, root);
        resolve(subrender.replace(/^./mg, `${prefix}$&`));
      } else {
        error(`${templatePath} not found (in ${path})`);
        resolve(`${prefix}<!-- static component not found: ${href} -->`);
      }
    });
    waiting.push(waitfor);
  });

  const templates = await Promise.all(waiting);
  return html.replace(renderSlotRegEx, () => templates.shift());
}

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
        .then(html => renderAsyncStaticComponents(html, path, root))
        .then(html => writeFile(path, html));
        waiting.push(rendered);
      }
      await Promise.all(waiting);
    },
  };
}
