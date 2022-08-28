import { getMarkdownAsset } from './markdown'
import { getAuthCookie } from './auth'
import { UnauthorizedException } from './auth/errors'

export function apiError(ref, { error, headers }, status) {
  return apiResponse(ref, { errors: [error], headers }, status || error.status);
}

export function apiResponse(ref, { data, meta, errors, links, headers }, status=200) {
  const body = {};
  body.links = {
    'api-url': ref.baseurl,
    ...links,
  };
  if (data) {
    body.data = data;
  }
  if (errors) {
    body.errors = errors;
  }
  // WIP message
  if (ref.isAuth && status === 200) {
    body.meta = {
      version: 0.1,
      info: 'The API is a work in progress, currently limited to returning attributes, basic structure and raw markdown',
    };
  }
  if (meta) {
    Object.assign(body.meta, meta);
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'content-type': 'application/json;charset=UTF-8',
    }
  })
}

export function errorResponse(ref, { type, error, headers }) {
  // respond depending on API endpoint or not
  return ref.isApi
  ? apiError(ref, { error, headers })
  : new Response(`${error.status} ${error.title}`, {
    // files show the error status, pages redirect
    status: ref.isFile ? error.status : 302,
    headers: {
      ...headers,
      // extra headers for erroring pages
      ...(!ref.isFile && {
        // set the redirect location, with a hash-status for styling the page
        Location: `${ref.baseurl}#${error.status}`,
        // and reset any previously set auth cookies
        'Set-Cookie': getAuthCookie(ref.base),
      }),
    },
  });
}

// get a path reference based on the url and expected components
export function getPathRef(url, basePath, publicDir='public', sharedDir='shared') {
  const { origin, pathname } = new URL(url);

  // base without leading or trailing slashes
  const base = basePath.replace(/^\/|\/$/g, '');
  const baseurl = origin.concat(base ? `/${base}` : '');
  
  // split path into components
  const components = pathname.slice(base ? 1 : 0).split('/');

  // check we're under the base path
  const isBase = components[0] === base;
  
  // file don't end with a slash and have an [.] in the last path component (but not the last char)
  const isIndex = pathname.endsWith('/');
  const isFile = !isIndex && components.at(-1).slice(0, -1).includes('.');

  // anything beyond the base path needs auth, except for the public dir
  const isAuth = isBase && components.length > 1 && components[1] && components[1] !== publicDir;

  // put together basic ref, valid for any path
  const ref = {
    origin,
    pathname,
    isAuth,
    baseurl,
    base,
    isBase,
    isFile,
    components,
  };

  // anything outside the base path is a 404
  if (!isBase) {
    ref.is404 = true;
    // note that the asset endpoint can be anything except "/404"
    ref.asset = `${origin}/not-found-404`;
    return ref;
  }

  // should we add on an index.html?
  const assetSuffix = isFile || pathname.length - base.length < 3 ? '' : isIndex && 'index.html' || '.html';

  // if within the base path but auth isn't required (root or public) we'll return the ref as is
  if (!isAuth) {
    // remove the base path + slashes
    ref.endpoint = pathname.slice(2 + (base.length || -1));
    ref.asset = `${origin}/${ref.endpoint}${assetSuffix}`;
    return ref;
  }

  // components => [base]/api?/[route]/[user]/shared?/[...endpoint]
  const isApi = components[1] === 'api';
  if (isApi) {
    ref.isApi = true;
    ref.baseurl += '/api';
  }
  const [route, user, ...componentsEnd] = components.slice(isApi ? 2 : 1);
  const isShared = componentsEnd[0] === sharedDir;
  const endpoint = componentsEnd.join('/');

  const asset = user
  ? `${origin}/${isShared ? '' : route + '/'}${endpoint}${assetSuffix}`
  : origin.concat('/');

  return { ...ref, route, user, isShared, endpoint, asset };
}

export async function fetchRef(ref, { cf }, { ASSETS }) {
  const markdownAsset = getMarkdownAsset(ref);

  if (markdownAsset) {
    if (ref.isApi) {
      return apiResponse(ref, {
        data: markdownAsset.content,
        links: { href: ref.origin + ref.pathname }
      });
    }

    // return content (switching md content-type to stop it downloading)
    return new Response(markdownAsset.content, {
      headers: {
        'content-type': `text/${markdownAsset.type === 'md' ? 'plain' : 'html'}`,
      }
    });
  }

  if (ref.isAuth && ref.isFile && ref.components.at(-1) === 'auth.json') {
    return errorResponse(ref, { error: UnauthorizedException() })
  }

  return ASSETS.fetch(new Request(ref.asset, { cf }));
}