/***
 * Cloudflare Analytics
 * ===
 * 
 * To enable pageview analytics from the API you can provide an analytics token and (optionally)
 * a production hostname via vite environment variables in .env.local
 * 
 * Removing these environment variables will fully disable this script. 
 *
 * [ For full instructions see .env.local.example ]
 * 
 * ## Important Note (!)
 * API pageview analytics come at the expense of useful performance information provided by client
 * logs. If you would prefer performance logs, you should instead follow the standard analytics
 * procedure (per the Cloudflare dashboard) and automatically embed analytics in your page.
 * 
 * Using both methods will lead to innacurate analytics (double dipping).
 * **/

// These values are set in .env.local
const CF_ANALYTICS_TOKEN = import.meta.env.VITE_CF_ANALYTICS_TOKEN;
const CF_ANALYTICS_HOST = import.meta.env.VITE_CF_ANALYTICS_HOST;

// generate a UID for the pageload
function getPageloadId() {
  let chars = '';
  for (const val of crypto.getRandomValues(new Uint8Array(16))) {
    chars += (val + 256).toString(16).substr(1);
  }
  return `${chars.slice(0, 8)}-${chars.slice(8, 12)}-${chars.slice(12, 16)}-${chars.slice(16, 20)}-${chars.slice(20, 32)}`;
}

// generate the analytics payload, per beacon.js initial requests
function getPayload(location, referrer='', siteToken) {
  return {
    memory: {},
    resources: [],
    referrer,
    documentWriteIntervention: false,
    errorCount: 0,
    eventType: 1,
    firstPaint: 0,
    firstContentfulPaint: 0,
    si: undefined,
    st: 2,
    startTime: new Date().getTime(),
    versions: {
      js: '2021.12.0'
    },
    pageloadId: getPageloadId(),
    location,
    siteToken,
  }
}

// generate the analytics headers based on the original request
// note that identifying information (IP, etc) is not included
function getHeaders(ref, referrer, userAgent) {
  return new Headers({
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Content-Type': 'application/json',
    'Host': ref.hostname,
    'Origin': ref.origin,
    'User-Agent': userAgent,
    ...(referrer && { 'Referer': referrer }),
  });
}

// send an analytics beacon if enabled + production
export async function sendBeacon(ref, originalRequest, isPreview) {
  // no token? no logs for you
  if (ref.isFile || !CF_ANALYTICS_TOKEN) {
    return;
  }
  // production build with an analytics host set that doesn't match? no logs for you
  if (!isPreview && CF_ANALYTICS_HOST  && CF_ANALYTICS_HOST !== ref.hostname) {
    return;
  }

  // only debug log for preview builds
  if (isPreview) {
    return console.log(
      '[analytics:preview]\n → [Page View]',
      originalRequest.url,
      '\n → logs on',
      CF_ANALYTICS_HOST ? `${CF_ANALYTICS_HOST} only` : 'non-preview builds only',
    );
  }

  const referrer = originalRequest.headers.get('referer') ?? undefined;
  const userAgent = originalRequest.headers.get('user-agent') || 'WorkerBot/0.0.1';
  const headers = getHeaders(ref, referrer, userAgent);
  const payload = getPayload(originalRequest.url, referrer, CF_ANALYTICS_TOKEN);

  // post our web analytics payload
  return fetch('https://cloudflareinsights.com/cdn-cgi/rum', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}
