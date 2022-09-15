import { AUTH_ROUTES } from '@/worker/auth';
import logger from '@/utils/logger.js'
const { error } = logger('markdown', 'loader');
import { renderStaticComponents, renderStaticVars, resolveLink } from '@/plugins/static-components/static'
const markdownSlotRegEx = /^( *)?<slot [^>]*data-markdown[^>]*\/?>(?:<\/slot>)?/gm;

// we can't use this in the glob imports below (the globs can't include vars) but
// we will need it to properly resolve the template to the markdown, etc. We "could"
// import it from "publicDir" in the config, but as it needs to be manually included
// in the globs, we'd prefer the script to die hard if the assets dir changes
// [!] REMINDER [!]: this value needs to be manually updated in the globs below

// this value is set via a constant defined in vite.config.js
// it can't be used in the "glob" imports below
const contentDir = `/__CONTENT_DIR__`;

// note these are vite-specific "glob" imports and do not allow script based vars (e.g. `/${contentDir}/**`)
// .. see vite.config.js to update the __CONTENT_DIR__ constant
const markdownParsed = import.meta.glob('/__CONTENT_DIR__/**/*.md', { eager: true });
const markdownRaw = import.meta.glob('/__CONTENT_DIR__/**/*.md', { as: 'raw', eager: true });
const htmlTemplates = import.meta.glob('/__CONTENT_DIR__/**/template.html', { as: 'raw', eager: true });
const htmlComponents = import.meta.glob('/__COMPONENT_DIR__/**/*.html', { as: 'raw', eager: true });
let cache;

function getMarkdownTemplate(templatePath) {
  // return cache if it exists
  if (cache) {
    return cache.get(templatePath);
  }

  // otherwise generate a new cache
  cache = new Map();

  // generate per-route env vars based on the auth
  const authEnv = new Map([...AUTH_ROUTES.route].map(([route, auth]) => {
    const env = new Map();
    for (const [key, val] of Object.entries(auth)) {
      env.set(`AUTH_${key.toUpperCase()}`, val);
    };
    return [route, env];
  }));
  
  // we'll use the static-components plugin logic to render any static slots in the templates 
  for (const [path, template] of Object.entries(htmlTemplates)) {
    const pathKey = path.slice(contentDir.length, -3);
    const privateRouteEnv = pathKey.startsWith(`/__CONTENT_PRIVATE_DIR__/`) && authEnv.get(pathKey.slice(1).split('/')[1]);
    htmlTemplates[path] = renderStaticComponents(template, path, htmlComponents, privateRouteEnv);
  }

  // we'll use this to keep track of how many template/markdown files are loaded
  let assetsLoaded = 0;

  // iterate over templates and sort by pathname
  // this helps assign markdown to the closest relevant template
  const templateList = [];
  for (const [path, html] of Object.entries(htmlTemplates)) {
    ++assetsLoaded;
    templateList.push({
      path: path.replace(/[^/]+$/, ''),
      html,
    });
  }  
  templateList.sort((a, b) => b.path.localeCompare(a.path));

  // add rendered markdown and assigned template to cache
  for (const [path, { attributes, html, toc }] of Object.entries(markdownParsed)) {
    ++assetsLoaded;
    // remove the CONTENT_DIR prefix and the .md suffix
    const pathKey = path.slice(contentDir.length, -3);
    const template = templateList.find(template => path.startsWith(template.path))?.html;
    // retrive any auth env vars reletive to the route
    const privateRouteEnv = pathKey.startsWith(`/__CONTENT_PRIVATE_DIR__/`) && authEnv.get(pathKey.slice(1).split('/')[1]);

    const renderedHtml = renderStaticComponents(html, path, htmlComponents, privateRouteEnv);
    let md = markdownRaw[path].replace(/^---[\s\S]*?---\n\n/, '');
    if (privateRouteEnv) {
      md = renderStaticVars(md, privateRouteEnv);
    }

    cache.set(pathKey, {
      md, attributes, template,
      parsed: {
        html: renderedHtml,
        toc,
      },
    });
  }

  // warn if no assets are loaded!
  if (!assetsLoaded) {
    error(`no templates were loaded from ${contentDir} ... is this the right location?`)
  }

  // return the cache
  return cache.get(templatePath);
}

// load a rendered template/markdown file as html (or JSON) for a given path reference
export function getMarkdownAsset(ref) {
  // extract file, path and type (extension) from asset url
  // const [file, path, type] = !ref.isFile && ref.asset.slice(ref.origin.length).match(/^(.+)\.(html|md)$/) || [];
  if (ref.isFile && ref.asset.slice(-3) !== '.md') {
    return;
  }

  const [file, path, type] = ref.asset.slice(ref.origin.length).match(/^(.+)\.(html|md)$/) || [];

  // return on type mismatch (per regex list)
  if (!type) {
    return;
  }

  // retrieve the markdown template
  const markdown = getMarkdownTemplate(path);
  if (!markdown) {
    return;
  }

  // WIP: let's return some basic, but specially formatted data for the API
  if (ref.isApi) {
    const apiData = {
      type,
      content: {
        attributes: {
          ...markdown.attributes,
        },
        toc: markdown.parsed.toc,
        content: markdown.md,
      },
    };
    // localise links to current user
    if (markdown.attributes.links) {
      // iterate over lists, replacing opening tildas (~) with current base path
      apiData.content.attributes.links = markdown.attributes.links.map(link =>
        resolveLink(link, ref));
    }
    return apiData;
  }

  const isMD = type === 'md'

  // render the template
  if (!isMD && !markdown.html) {
    // replace <slot data-markdown> elements with the rendered HTML
    markdown.html = markdown.template?.replace(markdownSlotRegEx, (match, prefix) =>
      // ensure newline spaces are copied across
      markdown.parsed.html.replace(/^./mg, `${prefix}$&`))
      // include the route and endpoint in the body tag
      .replace(/(<body[^>]*)/, `$1 data-route="${ref.route}" data-path="${ref.endpoint}" `)
    // if template doesn't exist, just output the markdown (this should never happen)
    || markdown.parsed.html;
  }
  
  return {
    type,
    content: isMD ? markdown.md : markdown.html,
  };
}