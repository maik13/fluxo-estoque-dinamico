(() => {
  const BADGE_CLASS = 'p54-origin-indicator';
  const MARKED_ATTR = 'data-p54-marked';
  const AMBER = '#d97706';

  const css = `
    .${BADGE_CLASS} {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 6px;
      padding: 1px 7px;
      border: 1px solid rgba(217, 119, 6, 0.45);
      border-radius: 999px;
      background: rgba(251, 191, 36, 0.16);
      color: ${AMBER};
      font-size: 11px;
      font-weight: 700;
      line-height: 1.35;
      vertical-align: middle;
      white-space: nowrap;
    }
    .${BADGE_CLASS} svg {
      width: 13px;
      height: 13px;
      flex: none;
      stroke-width: 2.5;
    }
    .p54-origin-highlight {
      box-shadow: inset 4px 0 0 rgba(217, 119, 6, 0.9) !important;
    }
  `;

  const ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  `;

  const normalize = (value) => String(value || '').toLowerCase();

  const ensureStyle = () => {
    if (document.getElementById('p54-origin-indicator-style')) return;
    const style = document.createElement('style');
    style.id = 'p54-origin-indicator-style';
    style.textContent = css;
    document.head.appendChild(style);
  };

  const makeBadge = (detail) => {
    const badge = document.createElement('span');
    badge.className = BADGE_CLASS;
    badge.title = detail || 'Informação recebida/importada da planilha Página54';
    badge.setAttribute('aria-label', badge.title);
    badge.innerHTML = `${ICON}<span>Página54</span>`;
    return badge;
  };

  const rowDetails = (element) => {
    const row = element.closest('tr');
    const text = row ? row.innerText : element.innerText;
    const lineMatch = text.match(/linha\s+(\d+)/i);
    const idMatch = text.match(/(?:ID\s+)?((?:P54|FIN)-[a-z0-9-]+)/i);
    const syncMatch = text.match(/Sync:\s*([^\n]+)/i);
    const details = ['Origem: planilha Página54'];
    if (lineMatch) details.push(`linha ${lineMatch[1]}`);
    if (idMatch) details.push(`ID ${idMatch[1]}`);
    if (syncMatch) details.push(`status ${syncMatch[1].trim()}`);
    return details.join(' · ');
  };

  const hasExplicitPagina54Text = (text) => {
    const normalized = normalize(text);
    return normalized.includes('página54')
      || normalized.includes('pagina54')
      || normalized.includes('planilha histórica')
      || normalized.includes('planilha historica');
  };

  const isFinancialBalanceCardTitle = (element) => {
    const text = normalize(element.textContent);
    return text.includes('saldo bancário') || text.includes('saldo financeiro gerencial');
  };

  const shouldMark = (element) => {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    if (element.closest(`.${BADGE_CLASS}`)) return false;
    const tag = element.tagName;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH'].includes(tag)) return false;
    const text = element.textContent || '';
    if (!text.trim()) return false;
    return hasExplicitPagina54Text(text) || isFinancialBalanceCardTitle(element);
  };

  const bestTarget = (element) => {
    if (!element) return null;

    if (element.closest('td')) {
      const descriptionCell = element.closest('td');
      const titleLike = descriptionCell.querySelector('.font-medium') || descriptionCell;
      return titleLike;
    }

    if (element.closest('[class*="CardHeader"]')) return element;

    return element;
  };

  const markRow = (element) => {
    const row = element.closest('tr');
    if (row) row.classList.add('p54-origin-highlight');
  };

  const addIndicator = (rawElement) => {
    const element = bestTarget(rawElement);
    if (!element || element.getAttribute(MARKED_ATTR) === '1') return;
    if (element.querySelector(`.${BADGE_CLASS}`)) {
      element.setAttribute(MARKED_ATTR, '1');
      return;
    }

    element.appendChild(makeBadge(rowDetails(element)));
    element.setAttribute(MARKED_ATTR, '1');
    markRow(element);
  };

  const scan = () => {
    ensureStyle();

    const candidates = Array.from(document.querySelectorAll('td, th, div, span, p, h1, h2, h3, h4'));
    for (const element of candidates) {
      if (shouldMark(element)) addIndicator(element);
    }
  };

  const start = () => {
    scan();
    const observer = new MutationObserver(() => {
      window.clearTimeout(window.__p54IndicatorTimer);
      window.__p54IndicatorTimer = window.setTimeout(scan, 120);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
