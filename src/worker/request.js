import { getMarkdownAsset } from './markdown'
import { getAuthCookie } from './auth'
import { UnauthorizedException } from './auth/errors'

const FUZZY_DIRS = __FUZZY__;

function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'content-type': 'application/json;charset=UTF-8',
    }
  });
}

export function graphqlError() {
  return jsonResponse({ status: 401, message: 'Unauthorized' }, 401);
}

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
  return jsonResponse(body, status, headers);
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
export function getPathRef(url, basePath, publicDir=`__CONTENT_PUBLIC_DIR__`, sharedDir=`__CONTENT_SHARED_DIR__`, privateDir=`__CONTENT_PRIVATE_DIR__`) {
  const { hostname, origin, pathname } = new URL(url);

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

  
  // Note: per design everything requires auth, except for the public dir
  // ... in reality however, we need to consider fail-over cases such as where our worker isn't available
  // for routing. This might be due to a limit being hit or a partial service outage resulting in the
  // server switching to default "open" and given public access to all static assets. In such a case we
  // need to rely on low-level routing/redirects to protect our sensitive files. For this reason alone we
  // shadow-route all our sensitive requests, which basically boils down to our URL structure not fully
  // representing our file structure (at least for those sensitive files). In this way we can safely rely
  // on a worker to correctly authenticate a user and then use logic to serve an asset from a hidden route, 
  // knowing that if the worker isn't available the logic-less default routing will fail. The sensitive
  // route is obscured by randomly fuzzing the top-level directory on each deploy. While technically these
  // routes would be reachable in the event of a fail-over, they are effectively unguessable. For added
  // peace-of-mind, files sitting outside the designed directory structure are removed during build.

  // anything beyond the base path needs auth, except for the public dir (see note above)
  const isAuth = isBase && components.length > 1 && components[1] && components[1] !== publicDir;

  // put together basic ref, valid for any path
  const ref = {
    hostname,
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
  // only useful if you are hosting from a subdir e.g. domain.me/cv/
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
  }

  const isGraphQL = components[1] === 'graphql';
  if (isGraphQL) {
    ref.isGraphQL = true;
  }
  
  const isPrefixedRoute = isApi || isGraphQL;
  if (isPrefixedRoute) {
    ref.baseurl += `/${components[1]}`;
  }

  const [route, user, ...componentsEnd] = components.slice(isPrefixedRoute ? 2 : 1);
  const isShared = componentsEnd[0] === sharedDir;
  const isPrivate = user && !isShared;
  const endpoint = componentsEnd.join('/');

  const asset = user
  ? `${origin}/${isShared ? '' : `${privateDir}/${route}/`}${endpoint}${assetSuffix}`
  : origin.concat('/');

  const fuzzyDir = (isShared && FUZZY_DIRS[sharedDir]) || (isPrivate && FUZZY_DIRS[privateDir]);
  const assetFuzzy = fuzzyDir
  ? asset.replace(isShared ? sharedDir : privateDir, fuzzyDir)
  : ''; 

  return { ...ref, route, user, isShared, isPrivate, endpoint, asset, assetFuzzy };
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

  return ASSETS.fetch(new Request(ref.assetFuzzy || ref.asset, { cf }));
}