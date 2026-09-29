import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

// Page numbers to show: always the first and last page, the pages around the current one,
// and "..." for the gaps (e.g. 1 ... 4 5 6 ... 12)
const pageList = (current, pages) => {
  const wanted = new Set([1, pages, current - 1, current, current + 1]);
  const list = [];
  let last = 0;
  for (let p = 1; p <= pages; p += 1) {
    if (!wanted.has(p)) continue;
    if (p - last > 1) list.push(p - last === 2 ? p - 1 : `gap-${p}`);
    list.push(p);
    last = p;
  }
  return list;
};

// Table footer with Bootstrap pagination (theme styles in member.css: .ordr-pagination).
// Hidden when everything fits on one page.
export default function BootstrapPagination({ total, limit, offset, onChange, disabled = false }) {
  if (!total || total <= limit) return null;
  const pages = Math.ceil(total / limit);
  const current = Math.floor(offset / limit) + 1;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  const fmt = (n) => Number(n).toLocaleString('en-IN');
  const go = (page) => {
    if (disabled || page < 1 || page > pages || page === current) return;
    onChange((page - 1) * limit);
  };

  return (
    <div className="ordr-pagination">
      <span className="ordr-pagination-info">Showing {fmt(from)}–{fmt(to)} of {fmt(total)}</span>
      <nav aria-label="Table pages">
        <ul className="pagination mb-0">
          <li className={`page-item${current === 1 || disabled ? ' disabled' : ''}`}>
            <button type="button" className="page-link" aria-label="Previous page" onClick={() => go(current - 1)}>
              <FiChevronLeft /> <span className="ordr-pagination-label">Previous</span>
            </button>
          </li>
          {pageList(current, pages).map((p) =>
            typeof p === 'string' ? (
              <li key={p} className="page-item disabled">
                <span className="page-link">…</span>
              </li>
            ) : (
              <li key={p} className={`page-item${p === current ? ' active' : ''}${disabled && p !== current ? ' disabled' : ''}`}>
                <button
                  type="button"
                  className="page-link"
                  aria-label={`Page ${p}`}
                  aria-current={p === current ? 'page' : undefined}
                  onClick={() => go(p)}
                >
                  {fmt(p)}
                </button>
              </li>
            )
          )}
          <li className={`page-item${current === pages || disabled ? ' disabled' : ''}`}>
            <button type="button" className="page-link" aria-label="Next page" onClick={() => go(current + 1)}>
              <span className="ordr-pagination-label">Next</span> <FiChevronRight />
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
