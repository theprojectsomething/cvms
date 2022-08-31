const CF_ANALYTICS_TOKEN = import.meta.env.VITE_CF_ANALYTICS_TOKEN;

getPageloadId = () => {
  let chars = '';
  for (const val of crypto.getRandomValues(new Uint8Array(16))) {
    chars += (val + 256).toString(16).substr(1);
  }
  return `${chars.slice(0, 8)}-${chars.slice(8, 12)}-${chars.slice(12, 16)}-${chars.slice(16, 20)}-${chars.slice(20, 32)}`;
}

function getPayload(location, referrer='', token) {
  return {
    memory: {},
    resources: [],
    referrer, // => e.g. 'https://cv.theprojectsomething.com/',
    documentWriteIntervention: false,
    errorCount: 0,
    eventType: 1,
    firstPaint: 0,
    firstContentfulPaint: 0,
    si: 100,
    startTime: new Date().getTime(),
    versions: {
      js: '2021.12.0'
    },
    pageloadId: getPageloadId(),
    location: location, // => e.g 'https://cv.theprojectsomething.com/',
    siteToken: token, // => e.g. 'e478600fe8c141ed9f212635f8e17bf4',
    st: 2
  }
}

function getHeaders(origin, referrer, userAgent) {
  return {
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'content-type': 'application/json',
    'Host': origin.replace(/^https?:\/\//, ''), // => e.g 'cv.theprojectsomething.com',
    'Origin': origin, // => e.g 'https://cv.theprojectsomething.com'
    'User-Agent': userAgent,
    ...(referrer && {'Referer': referrer}), // => e.g. 'https://cv.theprojectsomething.com/',
  };
}

export async function sendBeacon(ref, originalRequest) {
  if (ref.isFile || !CF_ANALYTICS_TOKEN) {
    return;
  }
  const referrer = originalRequest.headers.get('referer') ?? undefined;
  const userAgent = originalRequest.headers.get('user-agent') || 'WorkerBot/0.0.1';
  const headers = getHeaders(ref.origin, referrer, userAgent);
  const payload = getPayload(
    originalRequest.url,
    referrer,
    CF_ANALYTICS_TOKEN,
  );

  const url = `${ref.origin}/cdn-cgi/rum?`
  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}
