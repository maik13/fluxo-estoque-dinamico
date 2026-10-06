(() => {
  const BADGE_CLASS = 'p54-clean-origin-badge';
  const ROW_CLASS = 'p54-clean-origin-row';
  const HEADER_CLASS = 'p54-clean-origin-header';
  const PROCESSED_ATTR = 'data-p54-clean-processed';

  const css = `
    .${BADGE_CLASS} {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 8px;
      padding: 2px 7px;
      border-radius: 999px;
      border: 1px solid rgba(217, 119, 6, 0.55);
      background: rgba(245, 158, 11, 0.14);
      color: #f59e0b;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
      white-space: nowrap;
      vertical-align: middle;
    }
    .${BADGE_CLASS} svg {
      width: 13px;
      height: 13px;
      flex: none;
      stroke-width: 2.6;
    }
    .${ROW_CLASS} {
      box-shadow: inset 4px 0 0 rgba(245, 158, 11, 0.95) !important;
    }
    .${HEADER_CLASS} {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-left: 10px;
      padding: 3px 9px;
      border-radius: 999px;
      border: 1px solid rgba(217, 119, 6, 0.45);
      background: rgba(245, 158, 11, 0.12);
      color: #f59e0b;
      font-size: 12px;
      font-weight: 700;
      vertical-align: middle;
    }
  `;

  function ensureStyle() {
    if (document.getElementById('p54-clean-style')) return;
    const style = document.createElement('style');
    style.id = 'p54-clean-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function iconSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>';
  }

  function createBadge(title) {
    const badge = document.createElement('span');
    badge.className = BADGE_CLASS;
    badge.title = title || 'Lançamento recebido da planilha Página54';
    badge.innerHTML = `${iconSvg()}<span>Página54</span>`;
    return badge;
  }

  function isFluxoCaixaScreen() {
    const bodyText = document.body?.innerText || '';
    return bodyText.includes('Fluxo de Caixa') && bodyText.includes('Visão sistêmica equivalente ao núcleo da Página54');
  }

  function isPagina54FinancialRow(row) {
    const text = row.innerText || '';
    return /Página54\s*·\s*linha\s+\d+/i.test(text) || /ID\s+P54-/i.test(text);
  }

  function detailsFromRow(row) {
    const text = row.innerText || '';
    const linha = text.match(/Página54\s*·\s*linha\s+\d+/i)?.[0];
    const id = text.match(/ID\s+P54-[A-Za-z0-9-]+/i)?.[0];
    const sync = text.match(/Sync:\s*[^\n]+/i)?.[0];
    const erro = text.match(/Erro:\s*[^\n]+/i)?.[0];
    return [linha, id, sync, erro].filter(Boolean).join(' | ') || 'Lançamento recebido da planilha Página54';
  }

  function markFinancialRows() {
    if (!isFluxoCaixaScreen()) return 0;

    let count = 0;
    document.querySelectorAll('tr').forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      if (!isPagina54FinancialRow(row)) return;

      row.classList.add(ROW_CLASS);
      count += 1;

      if (row.getAttribute(PROCESSED_ATTR) === '1') return;

      const title = detailsFromRow(row);
      const target = row.querySelector('.font-medium') || row.querySelector('td') || row;
      if (target instanceof HTMLElement && !target.querySelector(`.${BADGE_CLASS}`)) {
        target.appendChild(createBadge(title));
      }

      row.setAttribute(PROCESSED_ATTR, '1');
    });

    return count;
  }

  function markFinanceHeader(count) {
    const headings = Array.from(document.querySelectorAll('h2, h1'));
    const title = headings.find((el) => (el.textContent || '').trim() === 'Financeiro');
    if (!(title instanceof HTMLElement)) return;

    const existing = title.querySelector(`.${HEADER_CLASS}`);
    if (!count) {
      existing?.remove();
      return;
    }

    if (existing) {
      existing.textContent = `Página54: ${count} recebido${count === 1 ? '' : 's'}`;
      return;
    }

    const badge = document.createElement('span');
    badge.className = HEADER_CLASS;
    badge.title = 'Há lançamentos financeiros recebidos da planilha Página54 nesta tela';
    badge.textContent = `Página54: ${count} recebido${count === 1 ? '' : 's'}`;
    title.appendChild(badge);
  }

  let scheduled = false;
  function run() {
    scheduled = false;
    ensureStyle();
    const count = markFinancialRows();
    markFinanceHeader(count);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(run);
  }

  window.addEventListener('load', schedule);
  window.addEventListener('popstate', schedule);
  document.addEventListener('click', () => setTimeout(schedule, 150), true);

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  schedule();
})();
