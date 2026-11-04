// Portfolio interactions: scroll reveal, counters, bar chart, hero signal, LDPC iteration demo.
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- nav border on scroll ----------
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ---------- counters ----------
  function countUp(el) {
    const target = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || '0', 10);
    if (reduce || target === 0) { el.textContent = target.toFixed(dec); return; }
    const t0 = performance.now(), dur = 1400;
    const step = t => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (target * e).toFixed(dec);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- bars ----------
  function growBars(root) {
    const bars = root.querySelectorAll('.bar');
    const max = Math.max(...[...bars].map(b => parseFloat(b.dataset.w)));
    bars.forEach((b, i) => setTimeout(() => { b.style.width = (100 * parseFloat(b.dataset.w) / max) + '%'; }, reduce ? 0 : i * 140));
  }

  // ---------- reveal ----------
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      e.target.querySelectorAll('[data-count]').forEach(countUp);
      if (e.target.querySelector('.bars')) growBars(e.target);
      io.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // ---------- hero: noisy received signal vs decoded bits ----------
  const svg = document.querySelector('.wave');
  if (svg) {
    const bits = [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1];
    const X0 = 20, W = 380, n = bits.length, dx = W / n;
    const yHi = 70, yLo = 190, mid = 130;
    const clean = svg.querySelector('.clean'), noisy = svg.querySelector('.noisy'), g = svg.querySelector('.bits');
    let d = `M${X0} ${bits[0] ? yHi : yLo}`;
    bits.forEach((b, i) => {
      const y = b ? yHi : yLo, x = X0 + i * dx;
      d += ` L${x} ${y} L${x + dx} ${y}`;
    });
    clean.setAttribute('d', d);
    const labels = bits.map((b, i) => {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', X0 + (i + 0.5) * dx); t.setAttribute('y', 218); t.setAttribute('text-anchor', 'middle');
      t.textContent = b; g.appendChild(t); return t;
    });
    // deterministic pseudo-random so the drawing is stable between frames
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    function drawNoisy(phase) {
      let p = '';
      const steps = 120;
      for (let s = 0; s <= steps; s++) {
        const x = X0 + (s / steps) * W, i = Math.min(n - 1, Math.floor((x - X0) / dx));
        const ideal = bits[i] ? yHi + 28 : yLo - 28;
        const y = ideal + (rnd() - 0.5) * 38 + Math.sin(s * 0.3 + phase) * 7;
        p += (s ? ' L' : 'M') + x.toFixed(1) + ' ' + Math.max(28, Math.min(232, y)).toFixed(1);
      }
      noisy.setAttribute('d', p);
    }
    drawNoisy(0);
    if (!reduce) {
      let phase = 0, flips = [];
      setInterval(() => {
        phase += 0.6; drawNoisy(phase);
        labels.forEach((t, i) => { t.textContent = bits[i]; t.classList.remove('flip'); });
        flips = [Math.floor(rnd() * n), Math.floor(rnd() * n)];
        flips.forEach(i => { labels[i].textContent = 1 - bits[i]; labels[i].classList.add('flip'); });
        setTimeout(() => flips.forEach(i => { labels[i].textContent = bits[i]; labels[i].classList.remove('flip'); }), 900);
      }, 1800);
    }
  }

  // ---------- LDPC iteration demo (two real ZCU111 captures) ----------
  const CASES = {
    ok: {
      dir: 'assets/iter', crcFrom: 15,
      bits: [303, 205, 144, 106, 86, 66, 55, 40, 30, 27, 25, 17, 12, 7, 3, 0, 0, 0, 0, 0, 0],
      note: 'Real capture: QPSK 30×30, DAC −5.2 dBFS, 303 of 3,072 coded bits wrong at the receiver. Frames shown are from ' +
            'the PC reference NMS decoder; on the board, the Kria v3 output was bit-identical at iteration limits 0, 15 and 20, ' +
            'with CRC passing from iteration 15.',
    },
    fail: {
      dir: 'assets/iter_fail', crcFrom: null,
      bits: [394, 294, 241, 232, 223, 207, 206, 196, 199, 183, 181, 177, 174, 170, 157, 154, 158, 153, 144, 151, 160],
      note: 'Real capture: QPSK 30×30, DAC −6 dBFS, 394 of 3,072 coded bits wrong. Only 0.8 dB weaker than the case above, ' +
            'yet the decoder stalls: errors drop to about 150 and then oscillate, most codewords never converge and the CRC ' +
            'never passes, even after 50 iterations — the waterfall region of LDPC. Frames from the PC reference NMS decoder.',
    },
  };
  const TOTAL = 3072;
  const img = document.getElementById('iter-img');
  if (img) {
    const slider = document.getElementById('iter-slider'), play = document.getElementById('iter-play');
    const nEl = document.getElementById('iter-n'), bEl = document.getElementById('iter-bits'), cEl = document.getElementById('iter-crc');
    const cap = document.getElementById('iter-cap'), chart = document.getElementById('iter-chart');
    const note = document.getElementById('demo-note');
    const caseBtns = [...document.querySelectorAll('.cases [data-case]')];
    const frames = {};
    for (const k in CASES) {
      frames[k] = CASES[k].bits.map((_, i) => {
        const im = new Image(); im.src = `${CASES[k].dir}/it${String(i).padStart(2, '0')}.png`; return im.src;
      });
    }

    // chart with both curves; the selected one is drawn strong
    const W = 400, H = 150, L = 36, R = 10, T = 12, B = 24, maxY = 420;
    const X = i => L + (i / 20) * (W - L - R), Y = v => T + (1 - v / maxY) * (H - T - B);
    const ns = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs, text) => {
      const e = document.createElementNS(ns, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      if (text != null) e.textContent = text;
      chart.appendChild(e); return e;
    };
    [0, 100, 200, 300, 400].forEach(v => {
      el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'grid' });
      el('text', { x: L - 6, y: Y(v) + 3.5, 'text-anchor': 'end', class: 'tick' }, v);
    });
    [0, 5, 10, 15, 20].forEach(i => el('text', { x: X(i), y: H - 6, 'text-anchor': 'middle', class: 'tick' }, i));
    const okLine = el('line', { x1: X(15), x2: X(15), y1: T, y2: H - B, class: 'okline' });
    const okText = el('text', { x: X(15) + 4, y: T + 10, class: 'tick' }, 'CRC OK');
    const curves = {};
    const ptsOf = k => CASES[k].bits.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
    // all areas first, then all lines, so the dimmed curve stays visible on top of the filled one
    for (const k in CASES) curves[k] = { area: el('polygon', { points: `${X(0)},${Y(0)} ${ptsOf(k)} ${X(20)},${Y(0)}`, class: 'area' }) };
    for (const k in CASES) {
      Object.assign(curves[k], {
        line: el('polyline', { points: ptsOf(k), class: 'line ' + k }),
      });
    }
    el('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, class: 'axis' });
    const dot = el('circle', { cx: X(0), cy: Y(0), r: 5, class: 'dot' });

    let current = 'ok';
    function show(i) {
      const c = CASES[current], bits = c.bits;
      i = Math.max(0, Math.min(20, i | 0));
      slider.value = i; img.src = frames[current][i];
      nEl.textContent = i; bEl.textContent = bits[i];
      const sub = document.getElementById('cdec-sub');
      if (sub) sub.textContent = `iteration ${i} · ${bits[i]} errors`;
      const ok = c.crcFrom !== null && i >= c.crcFrom;
      cEl.textContent = ok ? 'CRC OK' : 'CRC fail';
      cEl.className = 'v ' + (ok ? 'ok' : 'no');
      cap.textContent = i === 0 ? 'Received, no decoding' : `After ${i} iteration${i > 1 ? 's' : ''}`;
      dot.setAttribute('cx', X(i)); dot.setAttribute('cy', Y(bits[i]));
      img.title = `${bits[i]} of ${TOTAL} coded bits wrong`;
    }
    function selectCase(k) {
      current = k;
      caseBtns.forEach(b => b.setAttribute('aria-checked', String(b.dataset.case === k)));
      for (const n in curves) {
        curves[n].line.classList.toggle('dim', n !== k);
        curves[n].area.style.display = n === k ? '' : 'none';
      }
      const hasOk = CASES[k].crcFrom !== null;
      okLine.style.display = hasOk ? '' : 'none';
      okText.style.display = hasOk ? '' : 'none';
      note.textContent = CASES[k].note;
      chart.classList.toggle('failing', k === 'fail');
    }
    let timer = null;
    function stop() { clearInterval(timer); timer = null; play.textContent = '▶ Play'; }
    function start(from) {
      let i = from; show(i); play.textContent = '❚❚ Pause';
      timer = setInterval(() => { i += 1; show(i); if (i >= 20) stop(); }, 450);
    }
    play.addEventListener('click', () => { if (timer) return stop(); start(+slider.value >= 20 ? 0 : +slider.value); });
    slider.addEventListener('input', () => { stop(); show(+slider.value); });
    caseBtns.forEach(b => b.addEventListener('click', () => { stop(); selectCase(b.dataset.case); start(0); }));
    selectCase('ok'); show(0);
    // auto-play once when the demo first scrolls into view
    if (!reduce) {
      const once = new IntersectionObserver(es => {
        if (es[0].isIntersecting) { once.disconnect(); setTimeout(() => play.click(), 600); }
      }, { threshold: 0.5 });
      once.observe(chart);
    }
  }

  // ---------- communication block diagram ----------
  const flow = document.getElementById('flow');
  if (flow) {
    const INFO = {
      src:  ['PC', 'Source —', '30×30 pixel-art image with 4 grey tones (900 pixels).'],
      senc: ['PC', 'Source encoder —', 'canonical Huffman over the pixels: 1,465 data bits + CRC-16 = 1,481 bits, about 5× smaller than 8-bit grey.'],
      cenc: ['PC', 'Channel encoder —', 'QC-LDPC(384,194): 8 codewords, 3,072 coded bits (rate ≈ 1/2) — the redundancy the decoder will use.'],
      mod:  ['ZCU111', 'Modulator · DAC —', 'QPSK at 407 MBd on a 407 MHz carrier, 48-symbol preamble; 25,440 samples played from DAC BRAM at 6.5 GS/s.'],
      ch:   ['ZCU111', 'Channel —', 'a real SMA cable from DAC to ADC (photo under “Hardware setup”). Lowering the DAC power to −5.2 dBFS made 303 of 3,072 bits arrive wrong.'],
      dem:  ['ZCU111 → PC', 'ADC · Demodulator —', '16,384 samples at 4.096 GS/s; preamble sync recovers timing and carrier phase, then soft symbols become LLRs.'],
      cdec: ['Kria FPGA', 'Channel decoder —', 'LDPC Normalized Min-Sum in the Kria PL (HLS v3). Use the slider below to step through its iterations.'],
      sdec: ['PC', 'Source decoder —', 'Huffman decoding with the agreed table, then CRC-16. One wrong bit shifts every later pixel, so CRC passes only when all errors are gone.'],
      sink: ['PC', 'Sink —', 'the recovered image: exact from iteration 15 onward.'],
    };
    const blocks = [...flow.querySelectorAll('.blk')];
    const order = ['src', 'senc', 'cenc', 'mod', 'ch', 'dem', 'cdec', 'sdec', 'sink'];
    const where = document.getElementById('flow-where'), title = document.getElementById('flow-title'), desc = document.getElementById('flow-desc');
    const pick = k => {
      blocks.forEach(b => b.classList.toggle('active', b.dataset.k === k));
      const [w, t, d] = INFO[k]; where.textContent = w; title.textContent = t; desc.textContent = d;
    };
    let tour = null;
    const stopTour = () => { clearInterval(tour); tour = null; };
    blocks.forEach(b => {
      b.addEventListener('mouseenter', () => { stopTour(); pick(b.dataset.k); });
      b.addEventListener('focus', () => { stopTour(); pick(b.dataset.k); });
      b.addEventListener('click', () => { stopTour(); pick(b.dataset.k); if (b.dataset.k === 'ch') { const hw = document.getElementById('hw'); if (hw && !hw.open) hw.open = true; } });
    });
    pick('cdec');
    // one guided pass through the chain when the diagram first becomes visible
    if (!reduce) {
      const seen = new IntersectionObserver(es => {
        if (!es[0].isIntersecting) return;
        seen.disconnect();
        let i = 0; pick(order[0]);
        tour = setInterval(() => { i += 1; if (i >= order.length) { stopTour(); pick('cdec'); return; } pick(order[i]); }, 1100);
      }, { threshold: 0.6 });
      seen.observe(flow);
    }
  }

  // ---------- lightbox for the hidden hardware screenshots ----------
  const box = document.getElementById('lightbox');
  if (box && box.showModal) {
    const big = box.querySelector('img');
    document.querySelectorAll('.zoom').forEach(z => z.addEventListener('click', () => {
      big.src = z.dataset.full; big.alt = z.querySelector('img').alt; box.showModal();
    }));
    box.addEventListener('click', () => box.close());
  }

  // ---------- project tracks: Digital IC / Embedded Systems ----------
  const tabs = [...document.querySelectorAll('.tabs [data-track]')];
  const projects = [...document.querySelectorAll('#projects .project')];
  const NOTES = {
    ic: 'Hardware design: HLS/RTL accelerators, FPGA integration and transistor-level circuits.',
    emb: 'Systems that run on real boards: SoC firmware, device communication, sensing and control.',
  };
  if (tabs.length) {
    tabs.forEach(t => {
      const n = projects.filter(p => p.dataset.tracks.split(' ').includes(t.dataset.track)).length;
      t.querySelector('.count').textContent = n;
    });
    const select = (track, animate) => {
      tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.track === track)));
      document.getElementById('track-note').textContent = NOTES[track];
      projects.forEach(p => {
        const show = p.dataset.tracks.split(' ').includes(track);
        p.classList.toggle('hidden', !show);
        p.classList.remove('enter');
        if (show && animate) { p.classList.add('in'); void p.offsetWidth; p.classList.add('enter'); }
      });
    };
    tabs.forEach(t => t.addEventListener('click', () => select(t.dataset.track, true)));
    document.querySelectorAll('[data-open]').forEach(a => a.addEventListener('click', () => select(a.dataset.open, true)));
    select('ic', false);
  }
})();
