import uPlot from 'https://cdn.jsdelivr.net/npm/uplot@1.6.22/dist/uPlot.esm.js'
import { cursorMemo, tooltipsPlugin } from './tooltip.plugin.js'

let plot;

const $el = document.querySelector('.plot');

const resizeObserver = new ResizeObserver((entries) => {
  if (!plot) {
    return;
  }
  for (const entry of entries) {
    const rect = entry.contentRect;
    return plot.setSize({
      width: entry.contentRect.width,
      height: plot.height ?? plot.root.offsetHeight,
    });
  }
});

resizeObserver.observe($el);

export function doPlot(data, onTooltip) {
  if (plot) {
    plot.setData(data);
  } else {
    makePlot(data, onTooltip);
  }
}

function makePlot(data, onTooltip) {
  // let's format our dates based on the locale
  // first, a month-day-year format
  const mdyyFormat = new Date(60*24*60*60*1000).toLocaleDateString()
  // replace day, month and year
  .replace(/1970/, '{YY}')
  .replace(/\d?3/, '{M}')
  .replace(/\d?2/, '{D}');
  // and a month-day format
  const mdFormat = mdyyFormat.replace(/{YY}\/|\/{YY}/, '');
  // and a full month-day format
  const mmmdFormat = mdFormat.replace('{M}', '{MMM}').replace('/', ' ');

  const opts = {
    id: 'pageviews',
    class: 'plot--pageviews',
    width: 800,
    height: 300,
    cursor: cursorMemo?.get(),
    plugins: [
      tooltipsPlugin({
        cursorMemo,
        onTooltip,
      }),
    ],
    series: [
      {
        value: (self, timestamp) => new Date(timestamp * 1000).toLocaleString(),
      },
      {
        show: true,
        label: 'Pageviews',
        stroke: '#1f77b4',
        width: 1,
        fill: '#aecde2',
      },
    ],
    axes: [
      {
        grid: {
          show: true,
          width: 1,
        },
        values: [
        // tick incr          default           year                             month    day                            hour     min                sec       mode
          [3600 * 24 * 365,   '{YYYY}',         null,                            null,    null,                          null,    null,              null,        1],
          [3600 * 24 * 28,    '{MMM}',          '\n{YYYY}',                      null,    null,                          null,    null,              null,        1],
          [3600 * 24,         mmmdFormat,       '\n{YYYY}',                      null,    null,                          null,    null,              null,        1],
          [3600,              '{h}{aa}',        `\n${mdyyFormat}`,               null,    `\n${mdFormat}`,               null,    null,              null,        1],
          [60,                '{h}:{mm}{aa}',   `\n${mdyyFormat}`,               null,    `\n${mdFormat}`,               null,    null,              null,        1],
          [1,                 ':{ss}',          `\n${mdyyFormat} {h}:{mm}{aa}`,  null,    `\n${mdFormat} {h}:{mm}{aa}`,  null,    '\n{h}:{mm}{aa}',  null,        1],
          [0.001,             ':{ss}.{fff}',    `\n${mdyyFormat} {h}:{mm}{aa}`,  null,    `\n${mdFormat} {h}:{mm}{aa}`,  null,    "\n{h}:{mm}{aa}",  null,        1],
        ],
      },
      {
        grid: {
          show: true,
          width: 1,
        },
      },
    ]
  };

  plot = new uPlot(opts, data, $el);
}