import { renderStaticComponents } from '/src/plugins/static-components/static'
const markdownSlotRegEx = /^( *)?<slot [^>]*data-markdown[^>]*\/?>(?:<\/slot>)?/gm;

// we can't use this in the glob imports below (the globs can't include vars) but
// we will need it to properly resolve the template to the markdown, etc. We "could"
// import it from "assetsDir" in the config, but as it needs to be manually included
// in the globs, we'd prefer the script to die hard if the assets dir changes
// [!] REMINDER [!]: this value needs to be manually updated in the globs below
const routesDir = '/routes';

// note these are vite-specific globe import .. they do not support vars (e.g. `${routesDir}/...`)
const markdownParsed = import.meta.glob('/routes/**/*.md', { eager: true });
const markdownRaw = import.meta.glob('/routes/**/*.md', { as: 'raw', eager: true });
const htmlTemplates = import.meta.glob('/routes/**/template.html', { as: 'raw', eager: true });
const htmlComponents = import.meta.glob('/src/components/**/*.html', { as: 'raw', eager: true });
let cache;

function getMarkdownTemplate(templatePath) {
  // return cache if it exists
  if (cache) {
    return cache.get(templatePath);
  }

  // otherwise generate a new cache
  cache = new Map();
  
  // we'll use the static-components plugin logic to render any static slots in the templates 
  for (const [path, template] of Object.entries(htmlTemplates)) {
    htmlTemplates[path] = renderStaticComponents(template, path, htmlComponents);
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
    const md = markdownRaw[path].replace(/---[\s\S]*?---\n\n/, '');
    const pathKey = path.slice(routesDir.length, -3);
    const template = templateList.find(template => path.startsWith(template.path))?.html;
    cache.set(pathKey, { md, attributes, parsed: { html, toc }, template });
  }

  // warn if no assets are loaded!
  if (!assetsLoaded) {
    console.error(`❌ [markdown:loader]: no templates were loaded from ${routesDir} ... is this the right location?`)
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
        link.replace(/^~/, ref.origin + ref.pathname).replace(/([^:])\/{2,}/g, '$1/'));
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
    // if template doesn't exist, just output the markdown (this should never happen)
    || markdown.parsed.html;
  }
  
  return { content: isMD ? markdown.md : markdown.html, type };
}