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

export async function generateToken(route, expires, secretKey=DEFAULT_SECRET_KEY, duration=MAX_TOKEN_DURATION) {
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

export async function verifyToken(token, routeActive, secretKey=DEFAULT_SECRET_KEY) {
  // deconstruct base64 token, limiting to expected number of components
  const [expiry, route64, macString] = getTokenComponents(from64(token), 3);

  // 1. reject if token has outwardly expired (i.e. provided expiry has past)
  if (Date.now() > expiry) {
    throw new Error('Token expired');
  }
 
  // 2. reject if route outwardly mismatches (i.e. provided route !== current route)
  const route = from64(route64);
  if (route !== routeActive) {
    throw new Error('URL mismatch');
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

  return { expires: new Date(+expiry), cached };
}

// clear hot-cache, either for a single token or everything (keys + tokens)
export function clearCache(token) {
  if (token) {
    return tokenCache.delete(token);
  } else {
    tokenCache.clear();
    keyCache.clear();
    return true;
  }
}

export default { verifyToken, generateToken };
