// Mermaid gantt bars are SVG <rect> elements with a single solid fill. To
// give the timeline a softer, more on-brand look we inject SVG <linearGradient>
// defs into each gantt SVG and rewire every bar's `fill` to point at the right
// gradient via inline style (which beats the solid-colour CSS fallback).
//
// IDs are made unique per SVG so multiple gantts on a page don't collide.

const SVG_NS = 'http://www.w3.org/2000/svg';

// Each entry: [bar-class, light-mode-stops, dark-mode-stops].
// Stops go from softer-saturated (left) to deeper-saturated (right) — same
// hue, two shades — so white task text stays readable across the whole bar.
// Mermaid v11 cycles section classes 0..N-1 then wraps back to 0, so the 5th
// section (Data Purger here) inherits `task0` rather than `task4`.
const SECTIONS = [
  { cls: 'active0', light: ['#818CF8', '#4F46E5'], dark: ['#C7D2FE', '#818CF8'] }, // indigo
  { cls: 'task1',   light: ['#A78BFA', '#7C3AED'], dark: ['#DDD6FE', '#A78BFA'] }, // violet
  { cls: 'done2',   light: ['#22D3EE', '#0E7490'], dark: ['#A5F3FC', '#22D3EE'] }, // cyan
  { cls: 'crit3',   light: ['#F59E0B', '#B45309'], dark: ['#FCD34D', '#F59E0B'] }, // amber
  { cls: 'task0',   light: ['#34D399', '#059669'], dark: ['#A7F3D0', '#34D399'] }, // mint
];

function gradientId(suffix, cls, theme) {
  return `bp-gantt-grad-${cls}-${theme}-${suffix}`;
}

function ensureDefs(svg) {
  let defs = svg.querySelector(':scope > defs');
  if (!defs) {
    defs = document.createElementNS(SVG_NS, 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  return defs;
}

function appendGradient(defs, id, stops) {
  if (defs.querySelector(`#${id}`)) return;
  const grad = document.createElementNS(SVG_NS, 'linearGradient');
  grad.setAttribute('id', id);
  grad.setAttribute('x1', '0%');
  grad.setAttribute('x2', '100%');
  grad.setAttribute('y1', '0%');
  grad.setAttribute('y2', '0%');
  stops.forEach((color, i) => {
    const stop = document.createElementNS(SVG_NS, 'stop');
    stop.setAttribute('offset', i === 0 ? '0%' : '100%');
    stop.setAttribute('stop-color', color);
    grad.appendChild(stop);
  });
  defs.appendChild(grad);
}

function isGanttSvg(svg) {
  // Mermaid v11 renders gantt charts inside <svg> elements with the class
  // `gantt` or with a child `<g class="gantt"...>`. The svg ancestor that
  // Docusaurus uses is `.docusaurus-mermaid-container`.
  if (svg.classList && svg.classList.contains('gantt')) return true;
  return !!svg.querySelector('g.section0, g.section1, .section0, .gantt');
}

function ensureWrapperClass(svg) {
  // Promote the mermaid container to wear `.bp-gantt-wrapper` so the
  // page's gantt-specific CSS rules keep matching. We do this here because
  // a JSX wrapper in MDX swallowed the code block at build time.
  const container = svg.closest('.docusaurus-mermaid-container');
  if (container && !container.classList.contains('bp-gantt-wrapper')) {
    container.classList.add('bp-gantt-wrapper');
  }
}

function applyToSvg(svg) {
  if (svg.dataset.bpGanttGradients === 'done') return;
  if (!isGanttSvg(svg)) return;
  ensureWrapperClass(svg);
  const suffix = svg.id || Math.random().toString(36).slice(2, 8);
  const defs = ensureDefs(svg);
  SECTIONS.forEach(({ cls, light, dark }) => {
    appendGradient(defs, gradientId(suffix, cls, 'light'), light);
    appendGradient(defs, gradientId(suffix, cls, 'dark'), dark);
  });
  // Wire each matching rect to the correct gradient for the current theme.
  // Use setProperty(..., 'important') so the inline style beats the solid-fill
  // !important fallbacks in custom.css.
  const apply = () => {
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    SECTIONS.forEach(({ cls }) => {
      svg.querySelectorAll(`rect.${cls}`).forEach((rect) => {
        rect.style.setProperty('fill', `url(#${gradientId(suffix, cls, theme)})`, 'important');
        rect.style.setProperty('stroke', 'none', 'important');
      });
    });
  };
  apply();
  svg.dataset.bpGanttGradients = 'done';
  svg.dataset.bpGanttSuffix = suffix;
  // Track this svg so theme-change handler can refresh fills
  if (!document.documentElement.__bpGanttSvgs) {
    document.documentElement.__bpGanttSvgs = new Set();
  }
  document.documentElement.__bpGanttSvgs.add(svg);
  if (!document.documentElement.__bpGanttApply) {
    document.documentElement.__bpGanttApply = function () {
      var theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      document.documentElement.__bpGanttSvgs.forEach(function (s) {
        var suf = s.id || s.dataset.bpGanttSuffix || '';
        SECTIONS.forEach(function (sec) {
          s.querySelectorAll('rect.' + sec.cls).forEach(function (rect) {
            rect.style.setProperty('fill', 'url(#' + gradientId(suf, sec.cls, theme) + ')', 'important');
            rect.style.setProperty('stroke', 'none', 'important');
          });
        });
      });
    };
  }
}

function processAll(root) {
  // The wrapper class is added by us, so we can't bootstrap from it.
  // Start from every mermaid container's <svg> and let isGanttSvg gate.
  root.querySelectorAll('.docusaurus-mermaid-container svg').forEach(applyToSvg);
}

if (typeof window !== 'undefined') {
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      try { processAll(document); } catch (e) {}
    });
  };

  const observer = new MutationObserver(schedule);
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
      schedule();
    });
  }
  schedule();

  // Refresh gradient bindings when Docusaurus toggles the theme attribute
  const themeObserver = new MutationObserver(() => {
    const fn = document.documentElement.__bpGanttApply;
    if (typeof fn === 'function') fn();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

export function onRouteDidUpdate() {
  if (typeof window !== 'undefined') {
    requestAnimationFrame(() => {
      try { processAll(document); } catch (e) {}
    });
  }
}
