import logger from '../../utils/logger';
const { error } = logger('plugins', 'static-components');

// match components e.g. <slot href=""></slot>
const renderSlotRegEx = /^( *)?<slot [^>]*href=(["'])([^\2]*?)\2[^>]*\/?>(?:<\/slot>)?/gm;
// match vars e.g. <slot :vars="in this form">
const slotVarsRegEx = / :([^ =>/]+)(?:=(["']?)([^\2]*?)\2(?=\W))?/g;

const resolvePath = (relative, absolute) =>
  new URL(relative, `path:${absolute}`).pathname;

export const resolveLink = (link, ref) =>
  link.replace(/^~/, ref.origin + ref.pathname).replace(/([^:])\/{2,}/g, '$1/');

function renderComponents(html, path, getTemplate, envVars, root='', forceAsync=false) {
  let isAsync = forceAsync;
  const list = [];

  const subRenderComponents = (template, templatePath, prefix, href) => {
    if (!template) {
      error(`${templatePath} not found (in ${path})`);
      return `${prefix}<!-- static component not found: ${href} -->`;
    }

    const subrender = renderComponents(template, templatePath, getTemplate, envVars, root, isAsync);
    return isAsync
    ? subrender.then(rendered => rendered.replace(/^./mg, `${prefix}$&`))
    : subrender.replace(/^./mg, `${prefix}$&`);
  }

  const htmlReplaced = html.replace(renderSlotRegEx, (...args) => {
    const [match,prefix='',,href] = args;

    const scopedVars = new Map(envVars || null);
    for (const [,key,,val] of match.slice(prefix.length).matchAll(slotVarsRegEx)) {
      scopedVars.set(key.toLowerCase().replace(/-+(\w)/g, (m, c) => c.toUpperCase()), val ?? true);
    }

    const templatePath = href[0] === '/' ? root + href : resolvePath(path, href);
    const template = getTemplate(templatePath);
    const templateIsPromise = template instanceof Promise && (isAsync = true);
    const replacement = templateIsPromise
    ? template.then(templateHtml => subRenderComponents(renderStaticVars(templateHtml, scopedVars), templatePath, prefix, href))
    : subRenderComponents(renderStaticVars(template, scopedVars), templatePath, prefix, href);
    list.push(replacement);
    return replacement;
  });

  return isAsync
  ? Promise.all(list).then(listResolved => html.replace(renderSlotRegEx, () => listResolved.shift()))
  : htmlReplaced;
}

export function renderStaticVars(str, varsMapInput) {
  const varsMap = varsMapInput instanceof Map ? varsMapInput : new Map();
  return str.replace(/{{(.*?)}}/g, (match, varInner) => {
    for (const varOrVal of varInner.trim().split(/ *\?\? */)) {
      if (varOrVal[0] === '"' || varOrVal[0] === '\'') {
        return varOrVal.replace(/^(["'])(.*?)\1?$/, '$2');
      } else if (varOrVal && varsMap.has(varOrVal)) {
        return varsMap.get(varOrVal);
      }
    }
    return '';
  });
}

export function renderStaticComponents(html, path, components, envVars, root) {
  const getTemplate = components instanceof Function ? components : templatePath => components[templatePath];
  const rendered = renderComponents(html, path, getTemplate, envVars, root);
  return rendered instanceof Promise
  ? rendered.then(renderedResolved => renderStaticVars(renderedResolved, envVars))
  : renderStaticVars(rendered, envVars);
}
