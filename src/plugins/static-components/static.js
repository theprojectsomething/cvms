import logger from '../../utils/logger';
const { error } = logger('plugins', 'static-components');

export const renderSlotRegEx = /^( *)?<slot [^>]*data-static-href=(["'])([^\2]*?)\2[^>]*\/?>(?:<\/slot>)?/gm;

export const resolvePath = (relative, absolute) =>
  new URL(relative, `path:${absolute}`).pathname;

export function renderStaticComponents(html, path, components) {
  return html.replace(renderSlotRegEx, (...args) => {
    const [,prefix='',,href] = args;
    const templatePath = href[0] === '/' ? href : resolvePath(href, path);
    const template = components[templatePath];
    if (template) {
      return renderStaticComponents(template, templatePath, components).replace(/^./mg, `${prefix}$&`);
    } else {
      error(`${templatePath} not found (in ${path})`);
      return `${prefix}<!-- static component not found: ${href} -->`;
    }
  });
}
