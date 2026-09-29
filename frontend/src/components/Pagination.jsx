import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

// Table footer for server-side paging: "Showing 51-100 of 1,234" with Previous / Next.
// Hidden when everything fits on one page, so short lists look exactly as before.
export default function Pagination({ total, limit, offset, onChange, disabled = false }) {
  if (!total || total <= limit) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  const fmt = (n) => Number(n).toLocaleString('en-IN');
  return (
    <div className="table-pagination">
      <span className="table-pagination-info">Showing {fmt(from)}–{fmt(to)} of {fmt(total)}</span>
      <div className="table-pagination-actions">
        <button
          type="button"
          className="thm-btn outline fz-14 p-2"
          disabled={disabled || offset === 0}
          onClick={() => onChange(Math.max(offset - limit, 0))}
        >
          <FiChevronLeft /> Previous
        </button>
        <span className="table-pagination-page">Page {fmt(page)} of {fmt(pages)}</span>
        <button
          type="button"
          className="thm-btn outline fz-14 p-2"
          disabled={disabled || to >= total}
          onClick={() => onChange(offset + limit)}
        >
          Next <FiChevronRight />
        </button>
      </div>
    </div>
  );
}
