/*
  PhantomFX effect library
  -------------------------
  This is where the actual effect logic lives. Admin never uploads raw
  arbitrary code — instead they pick one of these EFFECT_TYPES and set the
  default/min/max for each of its params. That's what keeps this safe: an
  item on the site is just { effectType: 'dustDissolve', params: {...} },
  never a string of code that gets executed. Visitors only ever see the
  rendered result, never any of this file's contents in the UI.

  To add a new effect: add an entry to EFFECT_TYPES below with a unique key,
  a "kind" of 'image' or 'audio', a "params" schema (same shape used
  elsewhere on the site: slider/color/toggle), and an "apply" function.

    image apply(ctx, canvas, sourceImage, values) -> draws into ctx
    audio apply(offlineCtx, sourceBuffer, values) -> returns a connected
                                                       AudioBufferSourceNode
                                                       (already .start()'d)
*/

const EFFECT_TYPES = {

  dustDissolve: {
    label: 'Dust Dissolve',
    kind: 'image',
    description: 'Breaks the image apart into drifting, fading particles.',
    params: [
      { key: 'particleCount', label: 'Particle Count', type: 'slider', min: 20, max: 800, default: 200 },
      { key: 'speed', label: 'Speed', type: 'slider', min: 1, max: 20, default: 6 },
      { key: 'dustColor', label: 'Dust Color', type: 'color', default: '#cccccc' },
      { key: 'coverage', label: 'Coverage %', type: 'slider', min: 5, max: 100, default: 45 }
    ],
    apply(ctx, canvas, img, v) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const count = Math.round(v.particleCount * (v.coverage / 100));
      ctx.fillStyle = v.dustColor;
      for (let i = 0; i < count; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = 1 + Math.random() * (v.speed / 3);
        const drift = (Math.random() - 0.5) * v.speed * 4;
        ctx.globalAlpha = 0.15 + Math.random() * 0.5;
        ctx.beginPath();
        ctx.arc(x + drift, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  },

  glitchShift: {
    label: 'Glitch Shift',
    kind: 'image',
    description: 'RGB channel split + horizontal slice glitching.',
    params: [
      { key: 'intensity', label: 'Intensity', type: 'slider', min: 1, max: 40, default: 12 },
      { key: 'sliceCount', label: 'Slice Count', type: 'slider', min: 2, max: 60, default: 18 },
      { key: 'colorSplit', label: 'Color Split', type: 'toggle', default: true }
    ],
    apply(ctx, canvas, img, v) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const sliceH = Math.max(1, Math.floor(canvas.height / v.sliceCount));

      for (let y = 0; y < canvas.height; y += sliceH) {
        const offset = (Math.random() - 0.5) * v.intensity * 2;
        const h = Math.min(sliceH, canvas.height - y);
        const slice = ctx.getImageData(0, y, canvas.width, h);
        ctx.putImageData(slice, offset, y);
      }

      if (v.colorSplit) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5;
        ctx.drawImage(canvas, -v.intensity / 2, 0);
        ctx.drawImage(canvas, v.intensity / 2, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  },

  echoDelay: {
    label: 'Echo / Delay',
    kind: 'audio',
    description: 'Classic repeating echo tail.',
    params: [
      { key: 'delayTime', label: 'Delay (sec)', type: 'slider', min: 0.05, max: 1, default: 0.3, step: 0.01 },
      { key: 'feedback', label: 'Feedback', type: 'slider', min: 0, max: 0.9, default: 0.4, step: 0.05 },
      { key: 'mix', label: 'Wet Mix %', type: 'slider', min: 0, max: 100, default: 40 }
    ],
    apply(offlineCtx, buffer, v) {
      const source = offlineCtx.createBufferSource();
      source.buffer = buffer;

      const delay = offlineCtx.createDelay(1.0);
      delay.delayTime.value = v.delayTime;
      const feedback = offlineCtx.createGain();
      feedback.gain.value = v.feedback;
      const wet = offlineCtx.createGain();
      wet.gain.value = v.mix / 100;
      const dry = offlineCtx.createGain();
      dry.gain.value = 1;

      source.connect(dry);
      dry.connect(offlineCtx.destination);

      source.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(offlineCtx.destination);

      source.start(0);
      return source;
    }
  },

  loFiCrush: {
    label: 'Lo-Fi Crush',
    kind: 'audio',
    description: 'Bitcrushed, muffled lo-fi tape sound.',
    params: [
      { key: 'cutoff', label: 'Muffle (Hz)', type: 'slider', min: 500, max: 8000, default: 2500 },
      { key: 'drive', label: 'Drive', type: 'slider', min: 1, max: 20, default: 6 }
    ],
    apply(offlineCtx, buffer, v) {
      const source = offlineCtx.createBufferSource();
      source.buffer = buffer;

      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = v.cutoff;

      const shaper = offlineCtx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * 2 - 1;
        curve[i] = Math.tanh(x * v.drive);
      }
      shaper.curve = curve;

      source.connect(filter);
      filter.connect(shaper);
      shaper.connect(offlineCtx.destination);

      source.start(0);
      return source;
    }
  }

};

// --- Param control rendering, shared by nav5.html (visitor tool) and
// admin.html (default-range setup) ---
function paramControlHtml(scope, itemId, p, value) {
  const valId = 'pv_' + scope + '_' + itemId + '_' + p.key;
  if (p.type === 'color') {
    return `<div class="param-row">
      <span class="param-label">${escapeHtml(p.label)}</span>
      <input type="color" value="${value}" oninput="onParamInput('${scope}', ${itemId}, '${p.key}', this.value)">
    </div>`;
  }
  if (p.type === 'toggle') {
    return `<div class="param-row">
      <span class="param-label">${escapeHtml(p.label)}</span>
      <input type="checkbox" ${value ? 'checked' : ''} onchange="onParamInput('${scope}', ${itemId}, '${p.key}', this.checked)">
    </div>`;
  }
  const step = p.step || 1;
  return `<div class="param-row">
    <span class="param-label">${escapeHtml(p.label)}</span>
    <input type="range" min="${p.min}" max="${p.max}" step="${step}" value="${value}"
      oninput="onParamInput('${scope}', ${itemId}, '${p.key}', this.value); document.getElementById('${valId}').textContent = this.value;">
    <span class="param-value" id="${valId}">${value}</span>
  </div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
