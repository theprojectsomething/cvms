/***
 *
 * Analytics GraphQL Utility 
 * 
 ***/

const apiUrl = '/graphql';
const maxFilterDuration = 8035200 * 1000; // 93 days
const maxFilterHistory = 15897600 * 1000; // 184 days
const minFilterDuration = 60 * 1000; // 1 min
// map of queries
const queryMap = {
  total: {
    query: `count, avg { sampleInterval }, sum { visits }`,
    order: 'sum_visits_DESC',
  },
  paths: {
    query: `count, avg { sampleInterval }, sum { visits }, dimensions { path: requestPath, datetime: datetimeHour }`,
    order: 'datetimeHour_DESC',
  },
  browsers: {
    query: `count, avg { sampleInterval }, sum { visits }, dimensions { metric: userAgentBrowser }`,
    order: 'sum_visits_DESC',
  },
  os: {
    query: `count, avg { sampleInterval }, sum { visits }, dimensions { metric: userAgentOS }`,
    order: 'sum_visits_DESC',
  },
  devices: {
    query: `count, avg { sampleInterval }, sum { visits }, dimensions { metric: deviceType }`,
    order: 'sum_visits_DESC',
  },
  countries: {
    query: `count, avg { sampleInterval }, sum { visits }, dimensions { metric: countryName }`,
    order: 'sum_visits_DESC',
  },
  referrers: {
    query: `count, avg { sampleInterval }, sum { visits }, dimensions { metric: refererHost }`,
    order: 'count_DESC',
  },
}

function getFilter({ to, from, duration, host, path }={}) {
  const filters = {};

  const now = Date.now();
  // set maximum available history as timestamp (plus 1 min for safety)
  let minFrom = now - maxFilterHistory + minFilterDuration;

  // if a to date/time is defined include a <= filter date 
  if (to) {
    filters.datetime_leq = new Date(to);
    // ensure date sits within maximumum available history (plus 1 min to ensure a min duration)
    const minTo = minFrom + minFilterDuration;
    if (filters.datetime_leq < minTo) {
      filters.datetime_leq.setTime(minTo);
    }
  }

  // set some boundaries for the 'from' time
  const timeTo = (filters.datetime_leq || now);
  // max from time is one minute before to time
  const maxFrom = timeTo - minFilterDuration;
  // min from time is ~93 days before to time, maxing out out max available history date
  minFrom = Math.max(minFrom, timeTo - maxFilterDuration + minFilterDuration);

  // set >= filter date ... this is always defined to ensure a valid query
  filters.datetime_geq = new Date(from
  // use 'duration' or max duration where 'from' isn't available
  || timeTo - (duration || maxFilterDuration));

  // ensure from date sits within previously defined bounds
  if (filters.datetime_geq > maxFrom) {
    filters.datetime_geq.setTime(maxFrom);
  } else if (filters.datetime_geq < minFrom) {
    filters.datetime_geq.setTime(minFrom);
  }

  if (host) {
    filters.requestHost = host;
  }
  if (path) {
    filters.requestPath = path;
  }

  return filters;
}

export const getAccountQuery = queries =>
`{
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      ${queries.join(', ')}
    }
  }
}`;

export function getSubQuery(type='paths', filter='$filter', orderBy='$order', limit='$limit', queryName='rumPageloadEventsAdaptiveGroups') {
  return `${type}: ${queryName}(filter: ${filter}, orderBy: [${queryMap[type].order || orderBy}], limit: ${limit}) { ${queryMap[type].query} }`;
}

export function getQuery(types) {
  const list = [];
  for (const type of [].concat(types || Object.keys(queryMap))) {
    const query = getSubQuery(type);
    list.push(query);
  }
  return getAccountQuery(list);
}

export function getQueryVars(filter, order='datetimeHour_DESC', limit=1000) {
  return {
    filter: getFilter(filter),
    limit,
    order,
  };
}

export async function fetchQuery(filter, queries) {
  const queryData = {
    query: getQuery(queries),
    variables: getQueryVars(filter),
  };
  const request = new Request(apiUrl, {
    method: 'POST',
    body: JSON.stringify(queryData),
  });

  const response = await fetch(request).then(e => e.json());

  if (response.errors) {
    const error = response.errors[0];
    throw new Error(error.message);
  }

  return {
    filter: queryData?.variables.filter,
    data: response.data?.viewer?.accounts[0],
  };
}

export default fetchQuery;