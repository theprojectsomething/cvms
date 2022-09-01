import { sendBeacon } from './worker/analytics'
import { getAuth, verifyAuthCredentials, verifyAuthToken } from './worker/auth'
import { apiError, apiResponse, errorResponse, getPathRef, fetchRef } from './worker/request'

// this is the root / base path for our app and the worker should really be setup to run
// at this path on the domain. Everything below this path will 404 if it hits the worker
const basePath = '/';

export default {
  async fetch(request, env, ctx) {
    const ref = getPathRef(request.url, basePath);

    // analytics beacon
    try {
      await sendBeacon(ref, request, env.preview);
    } catch (e) {/* */}

    // shouldn't be able to access this url unless dns routing is buggy
    if (!ref.isBase) {
      // return a 404 based on the request
      return ref.isFile
      // file requests get a text response
      ? new Response('Not found', { status: 404 })
      // pages get our 404.html,
      : fetchRef(ref, request, env);
    }

    // if we don't need auth we can just return the asset
    if (request.method === 'GET' && !ref.isAuth) {
      return fetchRef(ref, request, env);
    }

    const auth = await getAuth(request, ref, env);

    // verify if no errors
    if (!auth.error) {
      if (auth.token) {
        await verifyAuthToken(auth, ref);
      } else {
        await verifyAuthCredentials(auth, ref);
      }
    }

    // return errors from auth or verification
    if (auth.error) {
      return errorResponse(ref, auth);
    }

    // prioritising for the auth user, but falling back to the ref user
    const routeUser = auth.user || ref.user;

    // redirect authenticated users to either /{route} or /{route}/{name}
    // if route is defined, user must be too to stop a redirect loop
    if (!ref.route || (routeUser && ref.user !== routeUser)) {
      // generate a url and an endpoint for redirecting
      const routeUrl = `${ref.baseurl}/${auth.route}/`;
      
      if (ref.isApi) {
        const userUrl = routeUrl.concat(routeUser || 'anon', '/');
        return apiResponse(ref, {
          data: {
            id: auth.route,
            type: 'token',
            attributes: {
              token: auth.token,
              expires: auth.verified.expires,
            },
          },
          links: {
            'api-url': userUrl,
          },
          headers: {
            ...auth.headers,
            Location: userUrl.concat(ref.endpoint),
          },
        }, 302);
      }
      
      // non-api should just redirect with headers
      return new Response('Ok', {
        status: 302,
        headers: {
          'Location': routeUser ? routeUrl.concat(routeUser, '/', ref.endpoint) : routeUrl,
          // this probably includes auth
          ...auth.headers,
        },
      });
    }

    /***
     * ===> {ROUTE} ALWAYS EXISTS FROM HERE <===
     ***/

    // serve the homepage to non-api where user is missing (api defaults to user=anon)
    if (!ref.isApi && !ref.user) {
      // make some minor state-based adjustments to the html response
      // we could lean on HTMLRewriter here / but below is clearer
      // const html = (await env.ASSETS.fetch(ref.baseurl).then(e => e.text()))
      const asset = await fetchRef(ref, request, env).then(e => e.text());
      // update [action] in the auth <form> to the current route
      const html = asset.replace(/(action="?[^" ]*)/, `$1${ref.route}/`)
      // remove the [required] attribute from <input name="pass">
      .replace(/(<input[^>]+?)required /, `$1`)
      return new Response(html, {
        headers: {
          'content-type': 'text/html',
        }
      });
    }

    /***
     * ===> {ROUTE}/{USER} ALWAYS EXISTS FROM HERE <===
     ***/

    // we can safely fetch the asset
    return fetchRef(ref, request, env);
  }
};
