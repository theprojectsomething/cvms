const name = "An example organisation or CV version";
const passphrase = "let me in";
const expires = "1 October 2022 00:00:0000 +10";
const auth = {
	name: name,
	passphrase: passphrase,
	expires: expires
};

const __vite_glob_0_0$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  name,
  passphrase,
  expires,
  default: auth
}, Symbol.toStringTag, { value: 'Module' }));

const __vite_glob_1_0 = "---\ntitle: Example Private Route\ndate: 2022-08-25 \nheadings:\n  - Welcome!\n  - Templates\n  - Private routes\n  - Special routes\nlinks:\n  - ~/shared/\n  - ~/shared/hello\n  - https://commonmark.org/\n  - https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax\n---\n\n# Example Private Route\n\n## Welcome!\n\nThis page is rendered as HTML from a [markdown-formatted](https://commonmark.org/) text file. Markdown allows you to quickly layout a page without any fuss, including things like:\n- formatted text including *italics*, **bold**, ~~strikethrough~~ or _**~~combinations~~**_\n- [external links](shared/hello) and [internal ones](#welcome)\n- lists (like this one)\n   1. and numbered\n   2. or sub lists\n   3. like this one\n- **headings (like above)** and paragraphs (like below)\n- plus [much more](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)\n\n### Templates\n\nSimple markdown documents are turned into 'stylish' HTML pages using **template.html** files, that live alongside them in the document structure. Each markdown document in the project is essentially a page on the website. For an example, take a look at the [markdown behind this page](/cv/example-private-route/anon/index.md).\n\n<style>\n/* this is css embedded in our markdown! */\n#welcome:target {\n  outline: none;\n}\n#welcome:target::before {\n  content: '';\n  display: inline-block;\n  width: 5em;\n  position: absolute;\n  height: 1em;\n  z-index: -1;\n  outline:  1px auto;\n}\n</style>\n\n### Private routes\n\nRoutes are just a fancy name for the folders containing your documents, but how you structure these folders is key to how access is given. Excusing some [useful exceptions](#special-routes), every file on the server is by default *private and secure*.\n\nTo give someone access to a document, you first share a **passphrase**. This can be entered into the homepage to reveal the route to your document and authorise access. You can create as many routes as you like, each with its own unique passphrase.\n\n### Special routes\n\nIn addition to private routes there are also two *special routes* that live in folders:\n1. The **public** route sits at [/cv/public/](/cv/public/) and contains files that can be accessed directly, without a passphrase\n2. The **shared** route is not public, but is accessible to anyone with a passphrase for *any route*. Files that sit under the shared route are accessible via an \"alias\" attached to the active route. For example, if you have the passphrase for **example-private-route** you would access shared files under [/cv/example-private-route/{name}/shared/](/cv/example-private-route/anon/shared/). Fun times.\n\n---\n\nAnd there's lots more features.\n\n*Good luck!*";

const __vite_glob_1_1 = "---\ntitle: Public index\ndate: 2022-08-25 \n---\n\n# PUBLIC\n\nThe template for this file sits in a parent folder.";

const __vite_glob_1_2 = "---\ntitle: Hello\ndate: 2022-08-25 \n---\n\n# HELLO";

const __vite_glob_1_3 = "---\ntitle: Shared index\ndate: 2022-08-25\nlinks:\n  - ~/hello\n---\n\n# SHARED\n\n[hello](hello)";

/***
 * Serverless Token Authentication
 * ===
 * 
 * ## Admin prep
 * 1. generate a secret[s] for use in all transactions (updating [s] will log everyone out) stored as a SECRET
 * 2. generate a passphrase[p], route[r] and expiry[re] for each org, stored in e.g. a KV [^a]
 * [^a]: Could also generate a per-org salt/nonce to allow invalidation without changing password - loses statelessness
 * 
 * ## Generating a token
 * 1. Retrieve [p] from request and map to route[r] stored in e.g. KV / secrets
 * 2. generate expiry[e] (e.g. +24hrs), taking into account route expiry[re]
 * 3. generate MAC[m] based on [e]@[r] [^b]
 * 4. generate base64 token [t64] based from [e]@[r]@[m]
 * 5. store [t64] in hot-cache for instant lookup
 * 6. return [t64] as bearer token, alongside [e] and [r]
 * 
 * [^b]: Could retrieve and append per-org salt/nonce here to allow invalidation - loses statelessness & hot-cache?
 * 
 * 
 * ## Verifying a token
 * 1. retrieve [t64] from "Authentication: Bearer [t64]" header
 * 2. deocde base64 and extract [e], [r] and [m]
 * 3. if [e] is in the past reject
 * 4. if [r] doesn't match current route reject
 * 5. if [t64] is in hot-cache, authenticate
 * 6. verify [e]@[r] against [m], authenticate or reject [^c]
 * 
 * [^c]: Could additionally validate against KV stored, per-org salt/nonce - loses statelessness & hot-cache?
 * 
 * ## For consideration
 * - not easy to invalidate a token, could be resolved with a per-org salt/nonce per [^a,b,c]
 * - hot-cache may cause minor chaos when updating secret keys, but it's probably worth it
 * 
 * ## See
 * - https://developers.cloudflare.com/workers/examples/signing-requests
 * 
 **/

const DEFAULT_SECRET_KEY = 'its a secret'; // overide in the generate / verify params
const MAX_TOKEN_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const TOKEN_SEP = '@'; // can be anything outside base64 charset /[a-z0-9+/=]/i

// hot-cache for keys & tokens, assumes serverless (hot/cold starts for cleanup)
const keyCache = new Map();
const tokenCache = new Set();
// used throughout for consistent encoding
const encoder = new TextEncoder();

// get (and cache) a crypto key capable of generating and verifying a MAC
async function getCryptoKey(key) {
  if (keyCache.has(key)) {
    return keyCache.get(key);
  }
  const cryptoKey = crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  keyCache.set(key, cryptoKey);
  return cryptoKey;
}

// generate a token string in the format, e.g salt@data
function getTokenString(...args) {
  return args.join(TOKEN_SEP);
}

// split a token into N number of components, with the final one containing any remaining string
// this method is faster than a capturing regex split [^1] or any tomfoolery with findIndex
// [^1]: new RegExp(`${TOKEN_SEP}(.*?(?=${TOKEN_SEP}))`.repeat(limit - 2) + `(?:${TOKEN_SEP})?(.*)`)
function getTokenComponents(token, limit) {
  if (limit < 2) {
    return [token];
  }
  const components = token.split(TOKEN_SEP, limit - 1);
  const limited = components.join(TOKEN_SEP); 
  return limited.length < token.length
  ? components.concat(token.slice(limited.length + TOKEN_SEP.length))
  : components;
}

// encode url-safe base64
function to64(string) {
  return btoa(string).replaceAll('+', '-');
}

// decode from url-safe base64
function from64(encoded) {
  return atob(encoded.replaceAll('-', '+'));
}

// convert our typed array to a string
function toMacString(mac) {
  return String.fromCharCode(...new Uint8Array(mac));
}

// convert our string back to a typed array
function fromMacString(macString) {
  const mac = new Uint8Array(macString.length);
  for (let i = 0; i < macString.length; ++i) {
    mac[i] = macString.charCodeAt(i);
  }
  return mac;
}

async function generateToken(route, expires, secretKey=DEFAULT_SECRET_KEY, duration=MAX_TOKEN_DURATION) {
  // set token expiry to smaller of route expiry and token duration
  const expiry = Math.min(expires, Date.now() + duration);
  
  // base64 encode route (to prevent token separator clashes)
  const route64 = to64(route);

  // generate token data [expiry]@[route64]
  const tokenData = getTokenString(expiry, route64);
  
  // sign the token data to create a signature
  const cryptoKey = await getCryptoKey(secretKey);
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(tokenData));

  // combine signature and data in form [data@data...]@[mac]
  // signature goes last because we can't ensure TOKEN_SEP chars are absent
  const tokenString = getTokenString(tokenData, toMacString(mac));

  // tokenise + base64 [tokenData]@[mac] and add to hot-cache
  const token = to64(tokenString);
  tokenCache.add(token);

  return { token, expires: new Date(expiry) };
}

async function verifyToken(token, routeActive, secretKey=DEFAULT_SECRET_KEY) {
  // deconstruct base64 token, limiting to expected number of components
  const [expiry, route64, macString] = getTokenComponents(from64(token), 3);

  // 1. reject if token has outwardly expired (i.e. provided expiry has past)
  if (Date.now() > expiry) {
    throw new Error('Token expired');
  }
 
  // 2. reject if route outwardly mismatches (i.e. provided route !== current route)
  // unless there is no active route, in which case we can proceed to verification
  const route = from64(route64);
  if (routeActive && route !== routeActive) {
    throw new Error('Not authorised for this route');
  }

  // 3. if token doesn't exist in hot-cache we need to cryptographically verify 
  const cached = tokenCache.has(token);
  if (!cached) {

    // prepare the provided data, secretKey and mac per @generateToken()
    const tokenData = getTokenString(expiry, route64);
    const cryptoKey = await getCryptoKey(secretKey);
    const mac = fromMacString(macString);

    // reject if signature doesn't match provided data
    const verified = await crypto.subtle.verify('HMAC', cryptoKey, mac, tokenData);
    if (!verified) {
      throw new Error('Invalid token');
    }

    // we can safely add the token to the hot-cache
    tokenCache.add(token);
  }

  return { expires: new Date(+expiry), cached, route };
}

const exception = (status, title, detail='') =>
  ({ status, title, detail });

const ExpiredException = detail =>
  exception(410, 'Gone', detail);

const UnauthorizedException = detail =>
  exception(401, 'Unauthorized', detail);

const BadRequestException = detail =>
  exception(400, 'Bad Request', detail);

const BasicAuthHeaders = {
  'WWW-Authenticate': 'Basic realm="Authenticate in the format [firstname]:[passphrase]"',
};

/***
 * Security / Authentication Info
 * ===
 * 
 * Depending on your needs (public build / deployment, etc.) you might consider overriding the key / method
 * below with e.g. a worker secret / remote env / KV lookup ... but keep in mind this code is worker-only
 * (i.e. never exposed to the client) and the values can easily be rolled over ... As long as the codebase
 * is kept in a private repo (which you would want for the routes) it should be OK to be left as-is
 * 
 * 1. To change the key, edit value for VITE_AUTH_SECRET_KEY in ".env.local"
 * 2. To add a secure route, add a new folder to your routes folder and include an "auth.json" at the root:
 *    {
 *      "name": "An example user or organisation name", <== optional
 *      "passphrase": "let me in", <== required**
 *      "expires": "1 October 2022 00:00:0000 +10" <== optional: force access to the route to expire
 *    }
 * 
 * **/

// retrieve our secret key - if it hasn't been set an error will be thrown during build, see "vite.config.js"
const SECRET_KEY = "8b1f694f37bdefc0f6ebeb9173328cb1";

// retrieve our auth routes
const ROUTE_AUTH = getRouteAuth();

// process authentication for each of the routes
function getRouteAuth() {
  const authRoutes = /* #__PURE__ */ Object.assign({"/routes/example-private-route/auth.json": __vite_glob_0_0$1});
  const markdownRaw = /* #__PURE__ */ Object.assign({"/routes/example-private-route/index.md": __vite_glob_1_0,"/routes/public/index.md": __vite_glob_1_1,"/routes/shared/hello.md": __vite_glob_1_2,"/routes/shared/index.md": __vite_glob_1_3});

  // create our auth dictionary
  const auth = new Map();

  // extract the routes dir from the glob import key (only works if there is an "auth.json" somewhere)
  const routesDir = Object.keys(authRoutes)[0]?.split('/').slice(0, -2).join('/');

  if (!routesDir) {
    console.error(`❌ [auth:route] no "auth.json" files exist in your routes\n- see /src/worker/auth/index.js`);
    return auth;
  }

  const availableRoutes = new Set(['public', 'shared']);
  for (const [path, routeAuth] of Object.entries(authRoutes)) {
    const route = path.split('/').at(-2);

    if (route === 'public' || route === 'shared') {
      console.error(`❌ [auth:route] "${routesDir}/${route}" includes an "auth.json" - you should remove this`);
      continue;
    }

    // add the route to the list of those with auth files
    availableRoutes.add(route);


    if (!routeAuth.passphrase) {
      console.error(`❌ [auth:route] "${path}" is missing a passphrase - ${route} is not accessible`);
      continue;
    }

    if (auth.has(routeAuth.passphrase)) {
      console.error(`❌ [auth:route] "${routesDir}/${route}" shares a passphrase with "${routesDir}/${auth.get(routeAuth.passphrase).route}" - ${route} is not accessible`);
      continue;
    }
    
    // convert expiry to a date object
    let expires = routeAuth.expires && new Date(routeAuth.expires);

    // set default expiry to a ~year in advance, warning if provided expiry is invalid
    if (isNaN(expires)) {
      // if expiry is a date object we know it has been set but is invalid
      if (expires) {
        console.error(`❌ [auth:route] "${path}" expiry date is invalid - it has been set to +1 year`);
      }
      // set expiry it to today + 364 days
      expires = new Date(new Date().setHours(24 * 364));
    }

    auth.set(routeAuth.passphrase, { ...routeAuth.default, expires, route });
  }
  for (const path in markdownRaw) {
    const route = path.slice(routesDir.length + 1).split('/')[0];
    if (route && !availableRoutes.has(route)) {
      availableRoutes.add(route);
      console.error(`❌ [auth:route] "${routesDir}/${route}" is missing an "auth.json" - ${route} is not accessible`);
    }
  }

  return auth;
}

const sanitiseUser = user =>
  user.replace(/[^a-z]/ig, '').slice(0, 20).toLowerCase();

async function cookieAuth(ref, request) {
  const cookies = request.headers.get('cookie');

  if (!cookies) {
    return;
  }

  for (const [, key, val] of cookies.matchAll(/([^= ]+)="?([^;"]+)/g)) {
    if (key === 'Authorization') {
      // set cookie data
      const data = {
        type: 'cookie',
        token: val,
      };

      // check for a user value in POST data
      const postUser = await postAuth(request, true);
      if (typeof postUser === 'string' || ref.user) {
        data.user = postUser || ref.user || 'anon';
      }

      return data;
    }
  }
}

async function postAuth(request, getUserForToken) {
  const contentType = request.headers.get('content-type');

  if (!contentType || !contentType.includes('form')) {
    return;
  }

  const formData = await request.clone().formData();
  const pass = formData.get('pass');
  let user = formData.get('user');

  if (getUserForToken) {
    return user && sanitiseUser(user);
  }

  if (!pass) {
    return;
  }

  const data = {
    type: 'post',
    pass: pass,
  };

  if (user) {
    data.user = sanitiseUser(user);
  }

  return data;
}

// modified from https://developers.cloudflare.com/workers/examples/basic-auth/
function headerAuth({ headers }) {
  const auth = headers.get('Authorization');

  // no auth header
  if (!auth) {
    return;
  }

  const [scheme, encoded] = auth.split(' ');
  const isBearer = scheme === 'Bearer';

  // The Authorization header must start with "Basic" or "Bearer"
  if (!encoded || (!isBearer && scheme !== 'Basic')) {
    return {
      error: BadRequestException('Malformed Authorization header'),
    };
  }

  // return the encoded token
  if (isBearer) {
    return {
      type: 'bearer',
      token: encoded,
    };
  }

  // Decodes the base64 value and performs unicode normalization.
  // @see https://datatracker.ietf.org/doc/html/rfc7613#section-3.3.2 (and #section-4.2.2)
  // @see https://dev.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
  const buffer = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  const decoded = new TextDecoder().decode(buffer).normalize();

  // The username & password are split by the first colon.
  //=> example: "username:password"
  const index = decoded.indexOf(':');

  // The user & password are split by the first colon and MUST NOT contain control characters.
  // @see https://tools.ietf.org/html/rfc5234#appendix-B.1 (=> "CTL = %x00-1F / %x7F")
  if (index === -1 || /[\0-\x1F\x7F]/.test(decoded)) {
    return {
      error: BadRequestException('Invalid credentials'),
    }
  }

  return {
    type: 'basic',
    pass: decoded.substring(index + 1),
    // for user we'll default to 'anon' where a name isn't supplied
    // saves roundtrips / user annoyance (in what is probably an API call)
    user: sanitiseUser(decoded.substring(0, index)) || 'anon',
  };
}

// verifies auth credentials against a route
async function verifyAuthCredentials(auth, ref) {
  // lookup data associated with passphrase
  const data = ROUTE_AUTH.get(auth.pass);

  if (!data) {
    // passphrase not found
    auth.error = UnauthorizedException('Passphrase not found');

    if (ref.isApi && auth.type === 'basic') {
      auth.headers = BasicAuthHeaders;
    }

  } else if (ref.route && data.route !== ref.route) {
    // request route doesn't match passphrase route
    auth.error = UnauthorizedException('Invalid credentials');
  } else if (data.expires < Date.now()) {
    // route has expired
    auth.error = ExpiredException('Link has expired');
  } else {
    // generate a token from the passphrase data
    const { token, expires } = await generateToken(data.route, data.expires, SECRET_KEY);
    auth.verified = { expires };
    auth.token = token;
    auth.route = data.route;

    // specify a HttpOnly auth cookie containing our token
    auth.headers = {
      'Set-Cookie': `Authorization="${token}"; HttpOnly; Secure; Path=${ref.base}${data.route}; SameSite=Strict; Expires="${expires.toUTCString()}"`,
    };
  }
}

// verifies an auth token against a route
async function verifyAuthToken(auth, ref) {
  try {
    auth.verified = await verifyToken(auth.token, ref.route, SECRET_KEY);
    // update the route to verified route
    auth.route = auth.verified.route;
  } catch (e) {
    auth.error = UnauthorizedException(e.message);
  }
}

// retrieve auth credentials / token from the current request
async function getAuth(request, ref) {
  getRouteAuth();
  // retrieve / parse credentials
  return await postAuth(request) || await cookieAuth(ref, request) || headerAuth(request) ||
  // default to authentication instructions
  {
    error: UnauthorizedException(
      `To access the API, generate a token via Basic Authentication or POST, where user={your first name} and pass={the shared passphrase} e.g > curl -u [firstname]:[passphrase] [api-url]; curl -X POST -d 'user=[firstname]&pass=[passphrase]' [api-url]`,
    ),
    headers: {
      ...(ref.isApi && BasicAuthHeaders),
    },
  };
}

const attributes$3 = {"title":"Example Private Route","date":"2022-08-25T00:00:00.000Z","headings":["Welcome!","Templates","Private routes","Special routes"],"links":["~/shared/","~/shared/hello","https://commonmark.org/","https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax"]};
const html$3 = "<h1><a id=\"example-private-route\" class=\"anchor\" href=\"#example-private-route\" aria-hidden=\"true\"></a>Example Private Route</h1>\n<h2><a id=\"welcome\" class=\"anchor\" href=\"#welcome\" aria-hidden=\"true\"></a>Welcome!</h2>\n<p>This page is rendered as HTML from a <a href=\"https://commonmark.org/\">markdown-formatted</a> text file. Markdown allows you to quickly layout a page without any fuss, including things like:</p>\n<ul>\n<li>formatted text including <em>italics</em>, <strong>bold</strong>, <s>strikethrough</s> or <em><strong><s>combinations</s></strong></em></li>\n<li><a href=\"shared/hello\">external links</a> and <a href=\"#welcome\">internal ones</a></li>\n<li>lists (like this one)\n<ol>\n<li>and numbered</li>\n<li>or sub lists</li>\n<li>like this one</li>\n</ol>\n</li>\n<li><strong>headings (like above)</strong> and paragraphs (like below)</li>\n<li>plus <a href=\"https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax\">much more</a></li>\n</ul>\n<h3><a id=\"templates\" class=\"anchor\" href=\"#templates\" aria-hidden=\"true\"></a>Templates</h3>\n<p>Simple markdown documents are turned into ‘stylish’ HTML pages using <strong>template.html</strong> files, that live alongside them in the document structure. Each markdown document in the project is essentially a page on the website. For an example, take a look at the <a href=\"/cv/example-private-route/anon/index.md\">markdown behind this page</a>.</p>\n<style>\n/* this is css embedded in our markdown! */\n#welcome:target {\n  outline: none;\n}\n#welcome:target::before {\n  content: '';\n  display: inline-block;\n  width: 5em;\n  position: absolute;\n  height: 1em;\n  z-index: -1;\n  outline:  1px auto;\n}\n</style>\n<h3><a id=\"private-routes\" class=\"anchor\" href=\"#private-routes\" aria-hidden=\"true\"></a>Private routes</h3>\n<p>Routes are just a fancy name for the folders containing your documents, but how you structure these folders is key to how access is given. Excusing some <a href=\"#special-routes\">useful exceptions</a>, every file on the server is by default <em>private and secure</em>.</p>\n<p>To give someone access to a document, you first share a <strong>passphrase</strong>. This can be entered into the homepage to reveal the route to your document and authorise access. You can create as many routes as you like, each with its own unique passphrase.</p>\n<h3><a id=\"special-routes\" class=\"anchor\" href=\"#special-routes\" aria-hidden=\"true\"></a>Special routes</h3>\n<p>In addition to private routes there are also two <em>special routes</em> that live in folders:</p>\n<ol>\n<li>The <strong>public</strong> route sits at <a href=\"/cv/public/\">/cv/public/</a> and contains files that can be accessed directly, without a passphrase</li>\n<li>The <strong>shared</strong> route is not public, but is accessible to anyone with a passphrase for <em>any route</em>. Files that sit under the shared route are accessible via an “alias” attached to the active route. For example, if you have the passphrase for <strong>example-private-route</strong> you would access shared files under <a href=\"/cv/example-private-route/anon/shared/\">/cv/example-private-route/{name}/shared/</a>. Fun times.</li>\n</ol>\n<hr>\n<p>And there’s lots more features.</p>\n<p><em>Good luck!</em></p>\n";
const toc$3 = [{"level":"1","content":"<a id=\"example-private-route\" class=\"anchor\" href=\"#example-private-route\" aria-hidden=\"true\"></a>Example Private Route"},{"level":"2","content":"<a id=\"welcome\" class=\"anchor\" href=\"#welcome\" aria-hidden=\"true\"></a>Welcome!"},{"level":"3","content":"<a id=\"templates\" class=\"anchor\" href=\"#templates\" aria-hidden=\"true\"></a>Templates"},{"level":"3","content":"<a id=\"private-routes\" class=\"anchor\" href=\"#private-routes\" aria-hidden=\"true\"></a>Private routes"},{"level":"3","content":"<a id=\"special-routes\" class=\"anchor\" href=\"#special-routes\" aria-hidden=\"true\"></a>Special routes"}];

const __vite_glob_0_0 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  attributes: attributes$3,
  html: html$3,
  toc: toc$3
}, Symbol.toStringTag, { value: 'Module' }));

const attributes$2 = {"title":"Public index","date":"2022-08-25T00:00:00.000Z"};
const html$2 = "<h1><a id=\"public\" class=\"anchor\" href=\"#public\" aria-hidden=\"true\"></a>PUBLIC</h1>\n<p>The template for this file sits in a parent folder.</p>\n";
const toc$2 = [{"level":"1","content":"<a id=\"public\" class=\"anchor\" href=\"#public\" aria-hidden=\"true\"></a>PUBLIC"}];

const __vite_glob_0_1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  attributes: attributes$2,
  html: html$2,
  toc: toc$2
}, Symbol.toStringTag, { value: 'Module' }));

const attributes$1 = {"title":"Hello","date":"2022-08-25T00:00:00.000Z"};
const html$1 = "<h1><a id=\"hello\" class=\"anchor\" href=\"#hello\" aria-hidden=\"true\"></a>HELLO</h1>\n";
const toc$1 = [{"level":"1","content":"<a id=\"hello\" class=\"anchor\" href=\"#hello\" aria-hidden=\"true\"></a>HELLO"}];

const __vite_glob_0_2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  attributes: attributes$1,
  html: html$1,
  toc: toc$1
}, Symbol.toStringTag, { value: 'Module' }));

const attributes = {"title":"Shared index","date":"2022-08-25T00:00:00.000Z","links":["~/hello"]};
const html = "<h1><a id=\"shared\" class=\"anchor\" href=\"#shared\" aria-hidden=\"true\"></a>SHARED</h1>\n<p><a href=\"hello\">hello</a></p>\n";
const toc = [{"level":"1","content":"<a id=\"shared\" class=\"anchor\" href=\"#shared\" aria-hidden=\"true\"></a>SHARED"}];

const __vite_glob_0_3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  attributes,
  html,
  toc
}, Symbol.toStringTag, { value: 'Module' }));

const __vite_glob_2_0 = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\" />\n  <title>the project:CV</title>\n  <slot data-static-href=\"/src/components/meta.html\" />\n</head>\n<body>\n<main class=\"page\">\n  <slot data-markdown />\n</main>\n<slot data-static-href=\"/src/components/footer.html\" />\n</body>\n</html>\n";

const __vite_glob_2_1 = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\" />\n  <title>the project:CV</title>\n  <slot data-static-href=\"/src/components/meta.html\" />\n</head>\n<body>\n<main>\n  <slot data-markdown />\n</main>\n<slot data-static-href=\"/src/components/footer.html\" />\n</body>\n</html>\n";

const __vite_glob_3_0 = "<footer>\n  <p>API access is <a href=\"/cv/api/\">available here</a></p>\n  <p>Having trouble? <a href=\"mailto:cv@theprojectsomething.com\">Reach out</a></p>\n</footer>";

const __vite_glob_3_1 = "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n<meta name=\"description\" content=\"Between the wish and the thing the world lies waiting.\">\n<meta name=\"author\" content=\"@som\">\n<meta name=\"keywords\" content=\"som, meaden\">\n<link rel=\"shortcut icon\" href=\"/cv/public/favicon.png\">\n<link rel=\"stylesheet\" type=\"text/css\" href=\"/cv/public/styles.css\" />";

const renderSlotRegEx = /^( *)?<slot [^>]*data-static-href=(["'])([^\2]*?)\2[^>]*\/?>(?:<\/slot>)?/gm;

const resolvePath = (relative, absolute) =>
  new URL(relative, `path:${absolute}`).pathname;

function renderStaticComponents(html, path, components) {
  return html.replace(renderSlotRegEx, (...args) => {
    const [,prefix='',,href] = args;
    const templatePath = href[0] === '/' ? href : resolvePath(href, path);
    const template = components[templatePath];
    if (template) {
      return renderStaticComponents(template, templatePath, components).replace(/^./mg, `${prefix}$&`);
    } else {
      console.error('❌ [plugin:static-components]', templatePath, `not found (in ${path})`);
      return `${prefix}<!-- static component not found: ${href} -->`;
    }
  });
}

const markdownSlotRegEx = /^( *)?<slot [^>]*data-markdown[^>]*\/?>(?:<\/slot>)?/gm;

// we can't use this in the glob imports below (the globs can't include vars) but
// we will need it to properly resolve the template to the markdown, etc. We "could"
// import it from "assetsDir" in the config, but as it needs to be manually included
// in the globs, we'd prefer the script to die hard if the assets dir changes
// [!] REMINDER [!]: this value needs to be manually updated in the globs below
const routesDir = '/routes';

// note these are vite-specific globe import .. they do not support vars (e.g. `${routesDir}/...`)
const markdownParsed = /* #__PURE__ */ Object.assign({"/routes/example-private-route/index.md": __vite_glob_0_0,"/routes/public/index.md": __vite_glob_0_1,"/routes/shared/hello.md": __vite_glob_0_2,"/routes/shared/index.md": __vite_glob_0_3});
const markdownRaw = /* #__PURE__ */ Object.assign({"/routes/example-private-route/index.md": __vite_glob_1_0,"/routes/public/index.md": __vite_glob_1_1,"/routes/shared/hello.md": __vite_glob_1_2,"/routes/shared/index.md": __vite_glob_1_3});
const htmlTemplates = /* #__PURE__ */ Object.assign({"/routes/example-private-route/template.html": __vite_glob_2_0,"/routes/template.html": __vite_glob_2_1});
const htmlComponents = /* #__PURE__ */ Object.assign({"/src/components/footer.html": __vite_glob_3_0,"/src/components/meta.html": __vite_glob_3_1});
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
    console.error(`❌ [markdown:loader]: no templates were loaded from ${routesDir} ... is this the right location?`);
  }

  // return the cache
  return cache.get(templatePath);
}

// load a rendered template/markdown file as html (or JSON) for a given path reference
function getMarkdownAsset(ref) {
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

  const isMD = type === 'md';

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

function apiError(ref, { error, headers }, status) {
  return apiResponse(ref, { errors: [error], headers }, status || error.status);
}

function apiResponse(ref, { data, meta, errors, links, headers }, status=200) {
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

function errorResponse(ref, { type, error, headers }) {
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
        'Set-Cookie': `Authorization=; HttpOnly; Secure; Path=${ref.base}; SameSite=Strict; Expires="${new Date().toUTCString()}"`,
      }),
    },
  });
}

// get a path reference based on the url and expected components
function getPathRef(url, basePath, publicDir='public', sharedDir='shared') {
  const { origin, pathname } = new URL(url);

  // base without leading or trailing slashes
  const base = basePath.replace(/^\/|\/$/g, '');
  const baseurl = `${origin}/${base}`;
  
  // split path into components
  const components = pathname.slice(1).split('/');

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

  const assetSuffix = isFile || pathname.length - base.length < 3 ? '' : isIndex && 'index.html' || '.html';

  // if within the base path but auth isn't required (root or public) we'll return the ref as is
  if (!isAuth) {
    // remove the base path + slashes
    ref.endpoint = pathname.slice(2 + base.length);
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

async function fetchRef(ref, { cf }, { ASSETS }) {
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

// this is the root / base path for our app and the worker should really be setup to run
// at this path on the domain. Everything below this path will 404 if it hits the worker
const basePath = '/cv/';

const _worker = {
  async fetch(request, env, ctx) {
    const ref = getPathRef(request.url, basePath);

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

    const auth = await getAuth(request, ref);

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
      .replace(/(<input[^>]+?)required /, `$1`);
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

export { _worker as default };
