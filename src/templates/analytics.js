/* Starsilk fan analytics dashboard application. Generated into
   docs/analytics/ by build/analytics_publication.py -- do not hand-edit
   the published copy.
   Dependency-free: SVG charts, tooltips, and transitions are hand-rolled so
   the page needs no third-party network resources. */
(function () {
  'use strict';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAY_MS = 86400000;
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function parseDay(s) {
    var p = String(s).split('-');
    return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function dayKey(ms) {
    var d = new Date(ms);
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function fmtDay(ms) {
    var d = new Date(ms);
    return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate();
  }
  function fmtDayFull(ms) {
    var d = new Date(ms);
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
  }
  function fmtInt(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function fmtCompact(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    if (n >= 1000) return (n / 1000).toFixed(2).replace(/0$/, '') + 'k';
    return String(Math.round(n));
  }
  function fmtPct(frac, digits) {
    return (frac * 100).toFixed(digits == null ? 1 : digits) + '%';
  }
  function fmtDelta(pct) {
    if (pct == null || !isFinite(pct)) return null;
    var sign = pct > 0.049 ? '+' : (pct < -0.049 ? '' : '');
    return sign + pct.toFixed(1) + '%';
  }
  function fmtDwell(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    if (m === 0) return s + 's';
    return m + 'm ' + (s < 10 ? '0' : '') + s + 's';
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function tween(duration, onFrame, onDone) {
    if (REDUCED || duration <= 0) { onFrame(1); if (onDone) onDone(); return; }
    var start = null;
    function frame(now) {
      if (start == null) start = now;
      var t = clamp((now - start) / duration, 0, 1);
      onFrame(easeOutCubic(t));
      if (t < 1) requestAnimationFrame(frame);
      else if (onDone) onDone();
    }
    requestAnimationFrame(frame);
  }
  function niceCeil(v) {
    if (v <= 0) return 1;
    var exp = Math.floor(Math.log10(v));
    var base = Math.pow(10, exp);
    var n = v / base;
    var step = n <= 1 ? 1 : (n <= 2 ? 2 : (n <= 2.5 ? 2.5 : (n <= 5 ? 5 : 10)));
    return step * base;
  }
  function smoothPath(pts) {
    if (pts.length === 0) return '';
    if (pts.length === 1) return 'M' + pts[0][0].toFixed(2) + ',' + pts[0][1].toFixed(2);
    if (pts.length === 2) {
      return 'M' + pts[0][0].toFixed(2) + ',' + pts[0][1].toFixed(2) +
        'L' + pts[1][0].toFixed(2) + ',' + pts[1][1].toFixed(2);
    }
    var d = 'M' + pts[0][0].toFixed(2) + ',' + pts[0][1].toFixed(2);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += 'C' + c1x.toFixed(2) + ',' + c1y.toFixed(2) + ' ' + c2x.toFixed(2) + ',' + c2y.toFixed(2) +
        ' ' + p2[0].toFixed(2) + ',' + p2[1].toFixed(2);
    }
    return d;
  }
  function resample(values, n) {
    if (values.length === n) return values.slice();
    if (values.length === 0) return new Array(n).fill(0);
    if (values.length === 1) return new Array(n).fill(values[0]);
    if (n === 1) return [values[values.length - 1]];
    var out = [];
    for (var i = 0; i < n; i++) {
      var pos = (i / (n - 1)) * (values.length - 1);
      var lo = Math.floor(pos), hi = Math.ceil(pos), f = pos - lo;
      out.push(values[lo] * (1 - f) + values[hi] * f);
    }
    return out;
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------------- tooltip ---------------- */
  var tip = null;
  function ensureTip() {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'ana-tooltip';
      tip.setAttribute('role', 'status');
      document.body.appendChild(tip);
    }
    return tip;
  }
  function showTip(html, x, y) {
    var el = ensureTip();
    el.innerHTML = html;
    el.classList.add('show');
    var pad = 14;
    var r = el.getBoundingClientRect();
    var left = clamp(x + 16, pad, window.innerWidth - r.width - pad);
    var top = clamp(y - r.height - 14, pad, window.innerHeight - r.height - pad);
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }
  function hideTip() { if (tip) tip.classList.remove('show'); }

  /* ---------------- dashboard ---------------- */
  var MODEL = null;
  var SEG = {}, COL = {}, FOLIOS = [], AFFIN = {};
  var DATA_MIN = 0, DATA_MAX = 0, FULL_STATS = null;
  var state = {
    preset: '30d', from: 0, to: 0, segment: 'all',
    sort: 'views', dir: 'desc', q: '', collection: 'all',
    series: { visits: true, readers: true }
  };
  var cache = {
    kpi: { visits: 0, readers: 0, dwell: 0, completions: 0 },
    line: { visits: null, readers: null },
    bars: null, donut: null
  };
  var lineGen = 0, barGen = 0, donutGen = 0, kpiGen = 0;

  function setStatus(msg) {
    var el = $('#anaStatus');
    if (el) el.textContent = msg;
  }
  function setError(msg) {
    var el = $('#anaError');
    if (el) {
      el.textContent = msg || '';
      el.hidden = !msg;
    }
  }

  function rowsInRange(from, to) {
    return MODEL.daily.filter(function (r) {
      var ms = parseDay(r.date);
      return ms >= from && ms <= to;
    });
  }
  function segTotals(rows, seg) {
    var v = 0, r = 0, d = 0, c = 0;
    rows.forEach(function (row) {
      if (seg === 'all') { v += row.visits; r += row.readers; d += row.dwell_sec; c += row.completions; }
      else { var s = row.by_segment[seg]; v += s.visits; r += s.readers; d += s.dwell_sec; c += s.completions; }
    });
    return { visits: v, readers: r, dwell: d, completions: c, days: rows.length };
  }
  /* Folio views for a segment, affinity-weighted so the folio total always
     equals the segment visit total for the same days. */
  function folioViews(rows, seg) {
    var n = FOLIOS.length;
    var out = new Array(n).fill(0);
    if (!rows.length) return out;
    if (seg === 'all') {
      rows.forEach(function (row) {
        for (var i = 0; i < n; i++) out[i] += row.by_folio[i];
      });
      return out;
    }
    var aff = AFFIN[seg];
    rows.forEach(function (row) {
      var segVisits = row.by_segment[seg].visits;
      if (!row.visits || !segVisits) return;
      var avg = 0;
      for (var i = 0; i < n; i++) avg += (row.by_folio[i] / row.visits) * aff[i];
      if (avg <= 0) return;
      var share = segVisits / row.visits;
      for (var j = 0; j < n; j++) out[j] += row.by_folio[j] * share * (aff[j] / avg);
    });
    return out;
  }
  function folioReaders(rows, seg) {
    /* Readers per folio follow each day's reader ratio for the segment. */
    var n = FOLIOS.length;
    var out = new Array(n).fill(0);
    if (!rows.length) return out;
    rows.forEach(function (row) {
      var weights = new Array(n);
      var wsum = 0;
      if (seg === 'all') {
        for (var i = 0; i < n; i++) { weights[i] = row.by_folio[i]; wsum += weights[i]; }
      } else {
        var s = row.by_segment[seg];
        var aff = AFFIN[seg], avg = 0;
        for (var k = 0; k < n; k++) avg += (row.by_folio[k] / row.visits) * aff[k];
        for (var j = 0; j < n; j++) {
          weights[j] = row.by_folio[j] * (s.visits / row.visits) * (aff[j] / avg);
          wsum += weights[j];
        }
      }
      if (!wsum) return;
      var segReaders = seg === 'all' ? row.readers : row.by_segment[seg].readers;
      for (var m = 0; m < n; m++) out[m] += segReaders * (weights[m] / wsum);
    });
    return out;
  }

  function prevWindowDelta(cur, from, to, seg) {
    var len = Math.round((to - from) / DAY_MS) + 1;
    var prevTo = from - DAY_MS;
    var prevFrom = prevTo - (len - 1) * DAY_MS;
    var prevRows = rowsInRange(Math.max(prevFrom, DATA_MIN), prevTo);
    var label;
    if (prevRows.length >= 3) {
      label = 'vs prior ' + prevRows.length + ' days';
      return { delta: rateDelta(cur, segTotals(prevRows, seg)), label: label };
    }
    var rows = rowsInRange(from, to);
    if (rows.length >= 4) {
      var half = Math.floor(rows.length / 2);
      var first = segTotals(rows.slice(0, half), seg);
      var second = segTotals(rows.slice(half), seg);
      label = '2nd half vs 1st half';
      return { delta: rateDelta(second, first), label: label };
    }
    return { delta: null, label: 'not enough history' };
  }
  function rateDelta(cur, prev) {
    function rate(t, key) { return t.days ? t[key] / t.days : 0; }
    function pct(a, b) { return b > 0 ? ((a - b) / b) * 100 : null; }
    return {
      visits: pct(rate(cur, 'visits'), rate(prev, 'visits')),
      readers: pct(rate(cur, 'readers'), rate(prev, 'readers')),
      dwell: pct(cur.visits ? cur.dwell / cur.visits : 0, prev.visits ? prev.dwell / prev.visits : 0),
      completions: pct(rate(cur, 'completions'), rate(prev, 'completions'))
    };
  }

  /* ---------------- KPIs ---------------- */
  function renderKPIs(rows) {
    var totals = segTotals(rows, state.segment);
    var avgDwell = totals.visits ? totals.dwell / totals.visits : 0;
    var cmp = prevWindowDelta(totals, state.from, state.to, state.segment);
    var gen = ++kpiGen;
    var defs = [
      { key: 'visits', value: totals.visits, format: fmtInt, series: rows.map(function (r) { return state.segment === 'all' ? r.visits : r.by_segment[state.segment].visits; }) },
      { key: 'readers', value: totals.readers, format: fmtInt, series: rows.map(function (r) { return state.segment === 'all' ? r.readers : r.by_segment[state.segment].readers; }) },
      { key: 'dwell', value: avgDwell, format: fmtDwell, series: rows.map(function (r) {
        var v = state.segment === 'all' ? r.visits : r.by_segment[state.segment].visits;
        var d = state.segment === 'all' ? r.dwell_sec : r.by_segment[state.segment].dwell_sec;
        return v ? d / v : 0;
      }) },
      { key: 'completions', value: totals.completions, format: fmtInt, series: rows.map(function (r) { return state.segment === 'all' ? r.completions : r.by_segment[state.segment].completions; }) }
    ];
    defs.forEach(function (def) {
      var card = $('.ana-kpi[data-kpi="' + def.key + '"]');
      if (!card) return;
      var valEl = $('.ana-kpi-value', card);
      var from = cache.kpi[def.key] || 0;
      var to = def.value;
      cache.kpi[def.key] = to;
      tween(450, function (t) {
        if (gen !== kpiGen) return;
        valEl.textContent = def.format(from + (to - from) * t);
      });
      var deltaEl = $('.ana-delta', card);
      var pct = cmp.delta ? cmp.delta[def.key] : null;
      var text = fmtDelta(pct);
      deltaEl.classList.remove('up', 'down', 'flat');
      if (text == null) {
        deltaEl.classList.add('flat');
        deltaEl.innerHTML = '<span aria-hidden="true">—</span><span class="sr-only">no trend available</span>';
        deltaEl.title = cmp.label;
      } else {
        var cls = pct > 0.049 ? 'up' : (pct < -0.049 ? 'down' : 'flat');
        var arrow = cls === 'up' ? '▲' : (cls === 'down' ? '▼' : '●');
        deltaEl.classList.add(cls);
        deltaEl.innerHTML = '<span aria-hidden="true">' + arrow + '</span> ' + esc(text);
        deltaEl.title = cmp.label;
      }
      drawSpark($('.ana-kpi-spark', card), def.series);
    });
  }
  function drawSpark(svg, series) {
    if (!svg) return;
    var W = 220, H = 38, P = 3;
    if (!series.length) { svg.innerHTML = ''; return; }
    var max = Math.max.apply(null, series.concat([1]));
    var min = Math.min.apply(null, series.concat([0]));
    var span = (max - min) || 1;
    function X(i) { return series.length === 1 ? W / 2 : P + (i / (series.length - 1)) * (W - 2 * P); }
    function Y(v) { return H - P - ((v - min) / span) * (H - 2 * P); }
    var line = series.map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ');
    var area = X(0).toFixed(1) + ',' + H + ' ' + line + ' ' + X(series.length - 1).toFixed(1) + ',' + H;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = '<polygon points="' + area + '"></polygon><polyline points="' + line + '"></polyline>';
  }

  /* ---------------- line chart ---------------- */
  var LINE_W = 720, LINE_H = 300, LINE_PAD = { l: 52, r: 14, t: 14, b: 30 };
  function downsample(rows, max) {
    if (rows.length <= max) return rows;
    var buckets = [], size = rows.length / max;
    for (var i = 0; i < max; i++) {
      var start = Math.floor(i * size), end = Math.max(start + 1, Math.floor((i + 1) * size));
      buckets.push(rows.slice(start, end));
    }
    return buckets.map(function (b) {
      var v = 0, r = 0;
      b.forEach(function (row) {
        v += state.segment === 'all' ? row.visits : row.by_segment[state.segment].visits;
        r += state.segment === 'all' ? row.readers : row.by_segment[state.segment].readers;
      });
      return { date: b[0].date, endDate: b[b.length - 1].date, visits: v / b.length, readers: r / b.length, bucketed: b.length > 1 };
    }).map(function (b) { return { date: b.date, visits: b.visits, readers: b.readers }; });
  }
  function renderLine(rows) {
    var svg = $('#lineChart');
    if (!svg) return;
    var data = downsample(rows, 120);
    var n = data.length;
    var visits = data.map(function (d) { return d.visits; });
    var readers = data.map(function (d) { return d.readers; });
    var shown = [];
    if (state.series.visits) shown = shown.concat(visits);
    if (state.series.readers) shown = shown.concat(readers);
    var max = niceCeil(Math.max.apply(null, shown.concat([1])));
    var iw = LINE_W - LINE_PAD.l - LINE_PAD.r, ih = LINE_H - LINE_PAD.t - LINE_PAD.b;
    function X(i) { return n === 1 ? LINE_PAD.l + iw / 2 : LINE_PAD.l + (i / (n - 1)) * iw; }
    function Y(v) { return LINE_PAD.t + ih - (v / max) * ih; }

    var html = '';
    var ticks = 4;
    for (var g = 0; g <= ticks; g++) {
      var gv = (max / ticks) * g;
      var gy = Y(gv);
      html += '<line class="ana-grid-line" x1="' + LINE_PAD.l + '" y1="' + gy.toFixed(1) +
        '" x2="' + (LINE_W - LINE_PAD.r) + '" y2="' + gy.toFixed(1) + '"/>' +
        '<text class="ana-tick" x="' + (LINE_PAD.l - 8) + '" y="' + (gy + 4).toFixed(1) + '" text-anchor="end">' +
        fmtCompact(gv) + '</text>';
    }
    var tickCount = Math.min(6, n);
    for (var t = 0; t < tickCount; t++) {
      var idx = tickCount === 1 ? 0 : Math.round((t / (tickCount - 1)) * (n - 1));
      html += '<text class="ana-tick" x="' + X(idx).toFixed(1) + '" y="' + (LINE_H - 8) + '" text-anchor="middle">' +
        esc(fmtDay(parseDay(data[idx].date))) + '</text>';
    }
    var vColor = 'var(--ana-line-visits)', rColor = 'var(--ana-line-readers)';
    html += '<path class="ana-area' + (state.series.visits ? '' : ' hidden') + '" id="lineAreaV" fill="' + vColor + '" opacity="0.12"></path>';
    html += '<path class="ana-line' + (state.series.visits ? '' : ' hidden') + '" id="linePathV" stroke="' + vColor + '"></path>';
    html += '<path class="ana-line' + (state.series.readers ? '' : ' hidden') + '" id="linePathR" stroke="' + rColor + '"></path>';
    html += '<line class="ana-crosshair" id="lineX" y1="' + LINE_PAD.t + '" y2="' + (LINE_PAD.t + ih) + '" visibility="hidden"/>';
    html += '<circle class="ana-hover-dot" id="lineDotV" r="5" fill="' + vColor + '" visibility="hidden"/>';
    html += '<circle class="ana-hover-dot" id="lineDotR" r="5" fill="' + rColor + '" visibility="hidden"/>';
    html += '<rect id="lineHit" x="' + LINE_PAD.l + '" y="' + LINE_PAD.t + '" width="' + iw + '" height="' + ih + '" fill="transparent"/>';
    svg.setAttribute('viewBox', '0 0 ' + LINE_W + ' ' + LINE_H);
    svg.innerHTML = html;

    function frameFor(vals, progress, prev) {
      var base = prev ? resample(prev, n) : new Array(n).fill(0);
      return vals.map(function (v, i) { return base[i] + (v - base[i]) * progress; });
    }
    var gen = ++lineGen;
    function draw(progress) {
      if (gen !== lineGen) return;
      var vv = frameFor(visits, progress, cache.line.visits);
      var rr = frameFor(readers, progress, cache.line.readers);
      var pv = vv.map(function (v, i) { return [X(i), Y(v)]; });
      var pr = rr.map(function (v, i) { return [X(i), Y(v)]; });
      $('#linePathV').setAttribute('d', smoothPath(pv));
      $('#linePathR').setAttribute('d', smoothPath(pr));
      var base = LINE_PAD.t + ih;
      $('#lineAreaV').setAttribute('d', smoothPath(pv) + 'L' + X(n - 1).toFixed(2) + ',' + base + 'L' + X(0).toFixed(2) + ',' + base + 'Z');
    }
    draw(REDUCED ? 1 : 0.001);
    tween(450, draw, function () {
      if (gen !== lineGen) return;
      cache.line.visits = visits;
      cache.line.readers = readers;
    });

    var hit = $('#lineHit');
    function nearest(evt) {
      var rect = svg.getBoundingClientRect();
      var scaleX = LINE_W / rect.width;
      var px = (evt.clientX - rect.left) * scaleX;
      if (n === 1) return 0;
      var frac = (px - LINE_PAD.l) / iw;
      return clamp(Math.round(frac * (n - 1)), 0, n - 1);
    }
    hit.addEventListener('mousemove', function (evt) {
      var i = nearest(evt);
      var lx = $('#lineX'), dv = $('#lineDotV'), dr = $('#lineDotR');
      lx.setAttribute('x1', X(i)); lx.setAttribute('x2', X(i));
      lx.setAttribute('visibility', 'visible');
      dv.setAttribute('cx', X(i)); dv.setAttribute('cy', Y(visits[i]));
      dv.setAttribute('visibility', state.series.visits ? 'visible' : 'hidden');
      dr.setAttribute('cx', X(i)); dr.setAttribute('cy', Y(readers[i]));
      dr.setAttribute('visibility', state.series.readers ? 'visible' : 'hidden');
      var tipHtml = '<div class="tt-title">' + esc(fmtDayFull(parseDay(data[i].date))) + '</div>' +
        (state.series.visits ? '<div class="tt-row"><span class="tt-dot" style="background:var(--ana-line-visits)"></span>Visits&nbsp;<b>' + fmtInt(visits[i]) + '</b></div>' : '') +
        (state.series.readers ? '<div class="tt-row"><span class="tt-dot" style="background:var(--ana-line-readers)"></span>Readers&nbsp;<b>' + fmtInt(readers[i]) + '</b></div>' : '');
      showTip(tipHtml, evt.clientX, evt.clientY);
    });
    hit.addEventListener('mouseleave', function () {
      $('#lineX').setAttribute('visibility', 'hidden');
      $('#lineDotV').setAttribute('visibility', 'hidden');
      $('#lineDotR').setAttribute('visibility', 'hidden');
      hideTip();
    });
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Daily visits and readers from ' + fmtDayFull(state.from) + ' to ' + fmtDayFull(state.to));
  }

  /* ---------------- bar chart ---------------- */
  var BAR_W = 520, BAR_H = 300, BAR_PAD = { l: 52, r: 10, t: 14, b: 44 };
  function renderBars(rows) {
    var svg = $('#barChart');
    if (!svg) return;
    var views = folioViews(rows, state.segment);
    var totals = MODEL.collections.map(function (c) {
      var sum = 0;
      FOLIOS.forEach(function (f, fi) { if (f.collection === c.id) sum += views[fi]; });
      return { id: c.id, label: c.label, color: c.color, value: sum };
    });
    var grand = totals.reduce(function (a, t) { return a + t.value; }, 0) || 1;
    var max = niceCeil(Math.max.apply(null, totals.map(function (t) { return t.value; }).concat([1])));
    var iw = BAR_W - BAR_PAD.l - BAR_PAD.r, ih = BAR_H - BAR_PAD.t - BAR_PAD.b;
    var slot = iw / totals.length;
    var bw = Math.min(56, slot * 0.58);
    function H(v) { return (v / max) * ih; }

    var html = '';
    for (var g = 0; g <= 4; g++) {
      var gv = (max / 4) * g;
      var gy = BAR_PAD.t + ih - (gv / max) * ih;
      html += '<line class="ana-grid-line" x1="' + BAR_PAD.l + '" y1="' + gy.toFixed(1) +
        '" x2="' + (BAR_W - BAR_PAD.r) + '" y2="' + gy.toFixed(1) + '"/>' +
        '<text class="ana-tick" x="' + (BAR_PAD.l - 8) + '" y="' + (gy + 4).toFixed(1) + '" text-anchor="end">' +
        fmtCompact(gv) + '</text>';
    }
    totals.forEach(function (t, i) {
      var cx = BAR_PAD.l + slot * i + slot / 2;
      var short = t.label.replace(' Folios', '').replace('Curated ', '');
      html += '<text class="ana-tick" x="' + cx.toFixed(1) + '" y="' + (BAR_H - 26) + '" text-anchor="middle">' +
        esc(short.split(' ')[0]) + '</text>';
      html += '<text class="ana-tick" x="' + cx.toFixed(1) + '" y="' + (BAR_H - 12) + '" text-anchor="middle">' +
        esc(short.split(' ').slice(1).join(' ') || ' ') + '</text>';
    });
    totals.forEach(function (t, i) {
      var cx = BAR_PAD.l + slot * i + slot / 2;
      html += '<rect class="ana-bar" id="bar' + i + '" x="' + (cx - bw / 2).toFixed(1) +
        '" width="' + bw.toFixed(1) + '" y="' + (BAR_PAD.t + ih) + '" height="0" rx="6" fill="' + t.color +
        '" tabindex="0" role="img" aria-label="' + esc(t.label + ': ' + fmtInt(t.value) + ' views') + '"/>';
    });
    svg.setAttribute('viewBox', '0 0 ' + BAR_W + ' ' + BAR_H);
    svg.innerHTML = html;

    var prev = cache.bars && cache.bars.length === totals.length ? cache.bars : totals.map(function () { return 0; });
    var gen = ++barGen;
    function draw(p) {
      if (gen !== barGen) return;
      totals.forEach(function (t, i) {
        var v = prev[i] + (t.value - prev[i]) * p;
        var h = Math.max(v > 0 ? 2 : 0, H(v));
        var rect = $('#bar' + i);
        rect.setAttribute('y', (BAR_PAD.t + ih - h).toFixed(1));
        rect.setAttribute('height', h.toFixed(1));
      });
    }
    draw(REDUCED ? 1 : 0.001);
    tween(450, draw, function () {
      if (gen !== barGen) return;
      cache.bars = totals.map(function (t) { return t.value; });
    });

    totals.forEach(function (t, i) {
      var rect = $('#bar' + i);
      function tipFor() {
        return '<div class="tt-title">' + esc(t.label) + '</div>' +
          '<div class="tt-row"><span class="tt-dot" style="background:' + t.color + '"></span>Views&nbsp;<b>' +
          fmtInt(t.value) + '</b>&nbsp;(' + fmtPct(t.value / grand) + ')</div>';
      }
      rect.addEventListener('mousemove', function (evt) { showTip(tipFor(), evt.clientX, evt.clientY); });
      rect.addEventListener('mouseleave', hideTip);
      rect.addEventListener('focus', function () {
        var r = rect.getBoundingClientRect();
        showTip(tipFor(), r.left + r.width / 2, r.top);
      });
      rect.addEventListener('blur', hideTip);
    });
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Views by collection from ' + fmtDayFull(state.from) + ' to ' + fmtDayFull(state.to));
  }

  /* ---------------- donut chart ---------------- */
  function donutSlice(cx, cy, rOuter, rInner, a0, a1) {
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    function pt(r, a) { return (cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2); }
    if (a1 - a0 >= Math.PI * 2 - 0.001) {
      return 'M' + (cx + rOuter).toFixed(2) + ',' + cy.toFixed(2) +
        'A' + rOuter + ',' + rOuter + ' 0 1,1 ' + (cx - rOuter).toFixed(2) + ',' + cy.toFixed(2) +
        'A' + rOuter + ',' + rOuter + ' 0 1,1 ' + (cx + rOuter).toFixed(2) + ',' + cy.toFixed(2) + 'Z' +
        'M' + (cx + rInner).toFixed(2) + ',' + cy.toFixed(2) +
        'A' + rInner + ',' + rInner + ' 0 1,0 ' + (cx - rInner).toFixed(2) + ',' + cy.toFixed(2) +
        'A' + rInner + ',' + rInner + ' 0 1,0 ' + (cx + rInner).toFixed(2) + ',' + cy.toFixed(2) + 'Z';
    }
    return 'M' + pt(rOuter, a0) + 'A' + rOuter + ',' + rOuter + ' 0 ' + large + ',1 ' + pt(rOuter, a1) +
      'L' + pt(rInner, a1) + 'A' + rInner + ',' + rInner + ' 0 ' + large + ',0 ' + pt(rInner, a0) + 'Z';
  }
  function renderDonut(rows) {
    var svg = $('#donutChart');
    var legend = $('#donutLegend');
    if (!svg || !legend) return;
    var totals = segTotals(rows, 'all');
    var values = MODEL.segments.map(function (s) {
      var v = 0;
      rows.forEach(function (r) { v += r.by_segment[s.id].visits; });
      return { id: s.id, label: s.label, color: s.color, value: v };
    });
    var grand = values.reduce(function (a, v) { return a + v.value; }, 0) || 1;
    var CX = 150, CY = 130, RO = 112, RI = 72, PAD = 0.025;
    var angles = [];
    var acc = -Math.PI / 2;
    values.forEach(function (v) {
      var frac = v.value / grand;
      var a0 = acc + PAD / 2, a1 = acc + frac * Math.PI * 2 - PAD / 2;
      if (frac <= 0) { angles.push([acc, acc]); }
      else angles.push([a0, Math.max(a0 + 0.01, a1)]);
      acc += frac * Math.PI * 2;
    });
    var html = '';
    values.forEach(function (v, i) {
      var dim = (state.segment !== 'all' && state.segment !== v.id) ? ' dim' : '';
      html += '<path class="ana-slice' + dim + '" id="slice' + i + '" fill="' + v.color +
        '" tabindex="0" role="img" aria-label="' + esc(v.label + ': ' + fmtInt(v.value) + ' visits, ' + fmtPct(v.value / grand)) + '"/>';
    });
    html += '<g class="ana-donut-center"><text class="big" x="' + CX + '" y="' + (CY - 2) + '" id="donutBig"></text>' +
      '<text class="small" x="' + CX + '" y="' + (CY + 22) + '" id="donutSmall"></text></g>';
    svg.setAttribute('viewBox', '0 0 300 260');
    svg.innerHTML = html;

    var prev = cache.donut && cache.donut.length === angles.length ? cache.donut : angles.map(function (a) { return [a[0], a[0]]; });
    var gen = ++donutGen;
    function draw(p) {
      if (gen !== donutGen) return;
      angles.forEach(function (a, i) {
        var a0 = prev[i][0] + (a[0] - prev[i][0]) * p;
        var a1 = prev[i][1] + (a[1] - prev[i][1]) * p;
        $('#slice' + i).setAttribute('d', donutSlice(CX, CY, RO, RI, a0, Math.max(a0, a1)));
      });
    }
    draw(REDUCED ? 1 : 0.001);
    tween(500, draw, function () {
      if (gen !== donutGen) return;
      cache.donut = angles;
    });

    function center(big, small) {
      $('#donutBig').textContent = big;
      $('#donutSmall').textContent = small;
    }
    function defaultCenter() {
      if (state.segment === 'all') center(fmtCompact(totals.visits), 'visits');
      else {
        var v = values.filter(function (x) { return x.id === state.segment; })[0];
        center(fmtCompact(v.value), v.label);
      }
    }
    defaultCenter();

    legend.innerHTML = '';
    values.forEach(function (v, i) {
      var li = document.createElement('li');
      if (state.segment === v.id) li.className = 'active';
      li.innerHTML = '<span class="swatch" style="background:' + v.color + '"></span><span>' + esc(v.label) +
        '</span><span class="val">' + fmtInt(v.value) + '</span><span class="pct">' + fmtPct(v.value / grand) + '</span>';
      legend.appendChild(li);
      var slice = $('#slice' + i);
      function tipFor() {
        return '<div class="tt-title">' + esc(v.label) + '</div>' +
          '<div class="tt-row"><span class="tt-dot" style="background:' + v.color + '"></span>Visits&nbsp;<b>' +
          fmtInt(v.value) + '</b>&nbsp;(' + fmtPct(v.value / grand) + ')</div>';
      }
      function on() {
        center(fmtCompact(v.value), v.label);
        li.classList.add('active');
        $all('.ana-slice', svg).forEach(function (s, si) { if (si !== i) s.classList.add('dim'); });
        slice.classList.remove('dim');
      }
      function off() {
        defaultCenter();
        if (state.segment !== v.id) li.classList.remove('active');
        $all('.ana-slice', svg).forEach(function (s, si) {
          var id = values[si].id;
          s.classList.toggle('dim', state.segment !== 'all' && state.segment !== id);
        });
      }
      slice.addEventListener('mousemove', function (evt) { on(); showTip(tipFor(), evt.clientX, evt.clientY); });
      slice.addEventListener('mouseleave', function () { off(); hideTip(); });
      slice.addEventListener('focus', function () {
        on();
        var r = slice.getBoundingClientRect();
        showTip(tipFor(), r.left + r.width / 2, r.top);
      });
      slice.addEventListener('blur', function () { off(); hideTip(); });
      li.addEventListener('mouseenter', on);
      li.addEventListener('mouseleave', off);
    });
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Visit share by reader segment from ' + fmtDayFull(state.from) + ' to ' + fmtDayFull(state.to));
  }

  /* ---------------- table ---------------- */
  function tableRows(rows) {
    var views = folioViews(rows, state.segment);
    var readers = folioReaders(rows, state.segment);
    var totals = segTotals(rows, state.segment);
    var avgDwell = totals.visits ? totals.dwell / totals.visits : 0;
    var fullAvg = FULL_STATS[state.segment].dwellRate || 1;
    var fullRate = FULL_STATS[state.segment].completionRate || 1;
    var curRate = totals.visits ? totals.completions / totals.visits : 0;
    var dwellFactor = fullAvg ? avgDwell / fullAvg : 1;
    var compFactor = fullRate ? curRate / fullRate : 1;
    var half = Math.floor(rows.length / 2);
    var first = rows.slice(0, half), second = rows.slice(half);
    var fvFirst = first.length > 1 ? folioViews(first, state.segment) : null;
    var fvSecond = second.length > 1 ? folioViews(second, state.segment) : null;
    return FOLIOS.map(function (f, i) {
      var trend = null;
      if (fvFirst && fvSecond && first.length && second.length) {
        var a = fvFirst[i] / first.length, b = fvSecond[i] / second.length;
        trend = a > 0 ? ((b - a) / a) * 100 : (b > 0 ? 100 : 0);
      }
      return {
        folio: f,
        views: views[i],
        readers: readers[i],
        dwell: f.dwell_sec * dwellFactor,
        completion: clamp(f.completion * compFactor, 0, 0.95),
        trend: trend
      };
    });
  }
  function renderTable(rows) {
    var body = $('#folioBody');
    if (!body) return;
    var data = tableRows(rows);
    var q = state.q.trim().toLowerCase();
    if (q) data = data.filter(function (d) { return d.folio.label.toLowerCase().indexOf(q) !== -1; });
    if (state.collection !== 'all') data = data.filter(function (d) { return d.folio.collection === state.collection; });
    var key = state.sort, dir = state.dir === 'asc' ? 1 : -1;
    data.sort(function (a, b) {
      var av = key === 'folio' ? a.folio.label : a[key];
      var bv = key === 'folio' ? b.folio.label : b[key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    if (!data.length) {
      body.innerHTML = '<tr><td colspan="6" class="ana-empty">No folios match the current filters.</td></tr>';
    } else {
      body.innerHTML = data.map(function (d) {
        var f = d.folio;
        var col = COL[f.collection];
        var trendHtml;
        if (d.trend == null) {
          trendHtml = '<span class="ana-delta flat">—</span>';
        } else {
          var cls = d.trend > 0.049 ? 'up' : (d.trend < -0.049 ? 'down' : 'flat');
          var arrow = cls === 'up' ? '▲' : (cls === 'down' ? '▼' : '●');
          trendHtml = '<span class="ana-delta ' + cls + '"><span aria-hidden="true">' + arrow + '</span> ' +
            esc(fmtDelta(d.trend)) + '</span>';
        }
        return '<tr><td><a class="ana-folio-link" href="' + esc(f.rel) + '">' + esc(f.label) +
          '</a><span class="ana-tag">' + esc(col.label) + '</span></td>' +
          '<td class="num">' + fmtInt(d.views) + '</td>' +
          '<td class="num">' + fmtInt(d.readers) + '</td>' +
          '<td class="num">' + esc(fmtDwell(d.dwell)) + '</td>' +
          '<td class="num">' + fmtPct(d.completion) + '</td>' +
          '<td class="num">' + trendHtml + '</td></tr>';
      }).join('');
    }
    $all('th button[data-sort]').forEach(function (btn) {
      var k = btn.getAttribute('data-sort');
      var th = btn.closest('th');
      var arrow = $('.arrow', btn);
      if (k === key) {
        th.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
        arrow.textContent = dir === 1 ? '▲' : '▼';
      } else {
        th.removeAttribute('aria-sort');
        arrow.textContent = '';
      }
    });
    $('#folioCount').textContent = 'Showing ' + data.length + ' of ' + FOLIOS.length + ' folios';
  }

  function exportCSV(rows) {
    var data = tableRows(rows);
    var q = state.q.trim().toLowerCase();
    if (q) data = data.filter(function (d) { return d.folio.label.toLowerCase().indexOf(q) !== -1; });
    if (state.collection !== 'all') data = data.filter(function (d) { return d.folio.collection === state.collection; });
    var lines = ['folio,collection,views,readers,avg_dwell_sec,completion_pct,trend_pct'];
    data.forEach(function (d) {
      lines.push([
        '"' + d.folio.label.replace(/"/g, '""') + '"',
        '"' + COL[d.folio.collection].label + '"',
        Math.round(d.views), Math.round(d.readers),
        Math.round(d.dwell), (d.completion * 100).toFixed(1),
        d.trend == null ? '' : d.trend.toFixed(1)
      ].join(','));
    });
    var blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'starsilk-fan-analytics-' + dayKey(state.from) + '-to-' + dayKey(state.to) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------------- state / filters ---------------- */
  function presetToRange(preset) {
    var end = DATA_MAX, start;
    if (preset === '7d') start = end - 6 * DAY_MS;
    else if (preset === '30d') start = end - 29 * DAY_MS;
    else if (preset === '90d') start = end - 89 * DAY_MS;
    else start = DATA_MIN;
    return { from: Math.max(start, DATA_MIN), to: end };
  }
  function syncURL() {
    var p = new URLSearchParams();
    p.set('range', state.preset);
    if (state.preset === 'custom') { p.set('from', dayKey(state.from)); p.set('to', dayKey(state.to)); }
    if (state.segment !== 'all') p.set('segment', state.segment);
    if (state.sort !== 'views' || state.dir !== 'desc') { p.set('sort', state.sort); p.set('dir', state.dir); }
    if (state.q) p.set('q', state.q);
    if (state.collection !== 'all') p.set('collection', state.collection);
    if (!state.series.visits) p.set('hide', 'visits');
    if (!state.series.readers) p.set('hide', (p.get('hide') ? p.get('hide') + ',' : '') + 'readers');
    try { history.replaceState(null, '', '?' + p.toString()); } catch (e) { /* non-http contexts */ }
  }
  function readURL() {
    var p = new URLSearchParams(location.search);
    var range = p.get('range');
    if (range === '7d' || range === '30d' || range === '90d' || range === 'all') {
      state.preset = range;
      var r = presetToRange(range);
      state.from = r.from; state.to = r.to;
    } else if (range === 'custom') {
      var from = p.get('from'), to = p.get('to');
      if (from && to) {
        var f = clamp(parseDay(from), DATA_MIN, DATA_MAX);
        var t = clamp(parseDay(to), DATA_MIN, DATA_MAX);
        if (f <= t) { state.preset = 'custom'; state.from = f; state.to = t; }
      }
    }
    var seg = p.get('segment');
    if (seg && (seg === 'all' || SEG[seg])) state.segment = seg;
    var sort = p.get('sort');
    if (sort && ['folio', 'views', 'readers', 'dwell', 'completion', 'trend'].indexOf(sort) !== -1) state.sort = sort;
    var dir = p.get('dir');
    if (dir === 'asc' || dir === 'desc') state.dir = dir;
    state.q = p.get('q') || '';
    var col = p.get('collection');
    if (col && (col === 'all' || COL[col])) state.collection = col;
    var hide = (p.get('hide') || '').split(',');
    if (hide.indexOf('visits') !== -1) state.series.visits = false;
    if (hide.indexOf('readers') !== -1) state.series.readers = false;
  }

  function segLabel() { return state.segment === 'all' ? 'All segments' : SEG[state.segment].label; }

  function renderAll() {
    hideTip();
    var rows = rowsInRange(state.from, state.to);
    if (!rows.length) {
      setError('No sample data covers that range. Showing the full sample instead.');
      state.preset = 'all';
      state.from = DATA_MIN; state.to = DATA_MAX;
      rows = rowsInRange(state.from, state.to);
      syncPresetUI();
    } else {
      setError(null);
    }
    renderKPIs(rows);
    renderLine(rows);
    renderBars(rows);
    renderDonut(rows);
    renderTable(rows);
    setStatus('Updated: ' + fmtDayFull(state.from) + ' to ' + fmtDayFull(state.to) + ' · ' +
      rows.length + ' days · ' + segLabel() + '.');
    syncURL();
  }

  function syncPresetUI() {
    $all('.ana-segmented button[data-preset]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-preset') === state.preset ? 'true' : 'false');
    });
    $('#anaFrom').value = dayKey(state.from);
    $('#anaTo').value = dayKey(state.to);
    $('#anaSegment').value = state.segment;
    $('#folioSearch').value = state.q;
    $('#folioCollection').value = state.collection;
    $all('#lineLegend button[data-series]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', state.series[btn.getAttribute('data-series')] ? 'true' : 'false');
    });
  }

  function wireControls() {
    $all('.ana-segmented button[data-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.preset = btn.getAttribute('data-preset');
        var r = presetToRange(state.preset);
        state.from = r.from; state.to = r.to;
        syncPresetUI();
        renderAll();
      });
    });
    $('#anaApply').addEventListener('click', function () {
      var f = $('#anaFrom').value, t = $('#anaTo').value;
      if (!f || !t) { setError('Choose both a start and an end date.'); return; }
      var from = parseDay(f), to = parseDay(t);
      if (from > to) { setError('Start date must be on or before the end date.'); return; }
      state.preset = 'custom';
      state.from = clamp(from, DATA_MIN, DATA_MAX);
      state.to = clamp(to, DATA_MIN, DATA_MAX);
      syncPresetUI();
      renderAll();
    });
    $('#anaSegment').addEventListener('change', function (evt) {
      state.segment = evt.target.value;
      renderAll();
    });
    $('#anaReset').addEventListener('click', function () {
      state.preset = '30d';
      var r = presetToRange('30d');
      state.from = r.from; state.to = r.to;
      state.segment = 'all';
      state.sort = 'views'; state.dir = 'desc';
      state.q = ''; state.collection = 'all';
      state.series.visits = true; state.series.readers = true;
      syncPresetUI();
      renderAll();
    });
    $all('#lineLegend button[data-series]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var k = btn.getAttribute('data-series');
        state.series[k] = !state.series[k];
        if (!state.series.visits && !state.series.readers) state.series[k] = true;
        btn.setAttribute('aria-pressed', state.series[k] ? 'true' : 'false');
        renderLine(rowsInRange(state.from, state.to));
        syncURL();
      });
    });
    var searchTimer = null;
    $('#folioSearch').addEventListener('input', function (evt) {
      clearTimeout(searchTimer);
      var v = evt.target.value;
      searchTimer = setTimeout(function () {
        state.q = v;
        renderTable(rowsInRange(state.from, state.to));
        syncURL();
      }, 160);
    });
    $('#folioCollection').addEventListener('change', function (evt) {
      state.collection = evt.target.value;
      renderTable(rowsInRange(state.from, state.to));
      syncURL();
    });
    $all('th button[data-sort]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var k = btn.getAttribute('data-sort');
        if (state.sort === k) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
        else { state.sort = k; state.dir = (k === 'folio') ? 'asc' : 'desc'; }
        renderTable(rowsInRange(state.from, state.to));
        syncURL();
      });
    });
    $('#folioExport').addEventListener('click', function () {
      exportCSV(rowsInRange(state.from, state.to));
    });
  }

  /* ---------------- theme ---------------- */
  function initTheme() {
    var btn = $('#anaTheme');
    var stored = null;
    try { stored = localStorage.getItem('starsilk-analytics-theme'); } catch (e) { stored = null; }
    function apply(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
      $('.label', btn).textContent = theme === 'light' ? 'Dark mode' : 'Light mode';
      $('.icon', btn).textContent = theme === 'light' ? '◐' : '☾';
      try { localStorage.setItem('starsilk-analytics-theme', theme); } catch (e) { /* private mode */ }
    }
    apply(stored === 'light' || stored === 'dark' ? stored : 'dark');
    btn.addEventListener('click', function () {
      apply(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
    });
  }

  /* ---------------- boot ---------------- */
  function computeFullStats() {
    FULL_STATS = { all: null };
    var all = segTotals(MODEL.daily, 'all');
    FULL_STATS.all = {
      dwellRate: all.visits ? all.dwell / all.visits : 0,
      completionRate: all.visits ? all.completions / all.visits : 0
    };
    MODEL.segments.forEach(function (s) {
      var t = segTotals(MODEL.daily, s.id);
      FULL_STATS[s.id] = {
        dwellRate: t.visits ? t.dwell / t.visits : 0,
        completionRate: t.visits ? t.completions / t.visits : 0
      };
    });
  }

  function init(model) {
    MODEL = model;
    MODEL.segments.forEach(function (s) { SEG[s.id] = s; });
    MODEL.collections.forEach(function (c) { COL[c.id] = c; });
    FOLIOS = MODEL.folios;
    AFFIN = MODEL.affinity;
    DATA_MIN = parseDay(MODEL.start_date);
    DATA_MAX = parseDay(MODEL.end_date);
    var r = presetToRange('30d');
    state.from = r.from; state.to = r.to;
    computeFullStats();
    readURL();
    if (!state.series.visits && !state.series.readers) state.series.visits = true;
    if (state.preset !== 'custom') {
      var rr = presetToRange(state.preset);
      state.from = rr.from; state.to = rr.to;
    }
    state.from = clamp(state.from, DATA_MIN, DATA_MAX);
    state.to = clamp(state.to, DATA_MIN, DATA_MAX);
    var fromEl = $('#anaFrom'), toEl = $('#anaTo');
    fromEl.min = MODEL.start_date; fromEl.max = MODEL.end_date;
    toEl.min = MODEL.start_date; toEl.max = MODEL.end_date;
    wireControls();
    syncPresetUI();
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    fetch('analytics.json', { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(init).catch(function (err) {
      setError('Could not load the sample dataset (' + err.message + ').');
      setStatus('Dashboard unavailable: sample data failed to load.');
    });
  });
})();
