// Modified from https://leeoniya.github.io/uPlot/demos/tooltips.html

let cursLeft = -10;
let cursTop = -10;

export const cursorMemo = {
  set: (left, top) => {
    cursLeft = left;
    cursTop = top;
  },
  get: () => ({left: cursLeft, top: cursTop}),
};

export function tooltipsPlugin(opts) {
  let cursortt;
  let seriestt;

  function init(u, opts, data) {
    let over = u.over;


    seriestt = opts.series.map((s, i) => {
      if (i == 0) return;

      let tt = document.createElement('div');
      tt.className = 'tooltip';
      tt.style.pointerEvents = 'none';
      tt.style.position = 'absolute';
      tt.style.background = 'rgba(0,0,0,0.1)';
      tt.style.width = tt.style.height = '1em';
      tt.style.transform = 'translate(-50%, -50%)';
      tt.style.borderRadius = '50%';
      tt.style.border = `1px solid ${s.stroke}`;
      tt.style.color = s.color;
      over.appendChild(tt);
      return tt;
    });

    let tt = cursortt = document.createElement('div');
    tt.className = 'tooltip';
    tt.style.whiteSpace = 'nowrap';
    tt.style.padding = '1.4em';
    tt.style.pointerEvents = 'none';
    tt.style.position = 'absolute';
    tt.style.background = '#fffe';
    over.appendChild(tt);

    function hideTips() {
      cursortt.style.display = 'none';
      seriestt.forEach((tt, i) => {
        if (i == 0) return;

        tt.style.display = 'none';
      });
    }

    function showTips() {
      cursortt.style.display = null;
      seriestt.forEach((tt, i) => {
        if (i == 0) return;

        let s = u.series[i];
        tt.style.display = s.show ? null : 'none';
      });
    }

    over.addEventListener('mouseleave', () => {
      if (!u.cursor._lock) {
        hideTips();
      }
    });

    over.addEventListener('mouseenter', () => {
      showTips();
    });

    if (u.cursor.left < 0)
      hideTips();
    else
      showTips();
  }

  function setCursor(u) {
    const {left, top, idx} = u.cursor;

    opts?.cursorMemo?.set(left, top);
    cursortt.style.left = left + 'px';
    cursortt.style.top = top + 'px';

    const xAbs = u.posToVal(left, 'x');
    const yAbs = u.posToVal(top, 'y');

    let html;
    seriestt.forEach((tt, i) => {
      if (i == 0) return;

      const s = u.series[i];

      if (s.show) {

        const xVal = u.data[0][idx];
        const yVal = u.data[i][idx];

        if (opts?.onTooltip) {
          html = opts.onTooltip(xVal, yVal, xAbs, yAbs);
        } else {
          cursortt.innerHTML = `(${xVal}, ${yVal})`;
        }

        tt.style.left = Math.round(u.valToPos(xVal, 'x')) + 'px';
        tt.style.top = Math.round(u.valToPos(yVal, s.scale)) + 'px';
      }
    });

    if (html) {
      cursortt.innerHTML = html;
    }
  }

  return {
    hooks: {
      init,
      setCursor,
      setScale: [
        (u, key) => {
        }
      ],
      setSeries: [
        (u, idx) => {
        }
      ],
    },
  };
}