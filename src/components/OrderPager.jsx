const pageButtonClass =
  "h-9 min-w-9 cursor-pointer rounded-full border border-black/8 bg-canvas px-3 text-sm font-normal leading-none tracking-[-0.224px] text-ink hover:bg-black/4 disabled:cursor-default disabled:opacity-[0.4]";

const pageButtonActiveClass =
  "h-9 min-w-9 cursor-pointer rounded-full border border-ink bg-ink px-3 text-sm font-normal leading-none tracking-[-0.224px] text-white";

function pageItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index);
  const pages = new Set([0, total - 1, current - 1, current, current + 1]);
  if (current <= 2) {
    pages.add(2);
    pages.add(3);
  }
  if (current >= total - 3) {
    pages.add(total - 4);
    pages.add(total - 3);
  }
  const sorted = [...pages]
    .filter((page) => page >= 0 && page < total)
    .sort((left, right) => left - right);
  const items = [];
  let previous = null;
  for (const page of sorted) {
    if (previous != null && page - previous > 1) items.push("…");
    items.push(page);
    previous = page;
  }
  return items;
}

export default function OrderPager({
  page,
  pageCount,
  total,
  pageSize,
  shown,
  onPage,
}) {
  if (!total || total <= pageSize) return null;
  const start = page * pageSize + 1;
  const end = start + shown - 1;

  return (
    <nav
      className="mt-6 flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between"
      aria-label="Phân trang"
    >
      <p className="m-0 text-sm font-normal leading-[1.29] tracking-[-0.224px] text-ink-muted-48">
        {start}–{end} / {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={pageButtonClass}
          type="button"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
        >
          Trước
        </button>
        {pageItems(page, pageCount).map((item, index) =>
          item === "…" ? (
            <span
              key={`ellipsis-${index}`}
              className="px-1 text-sm text-ink-muted-48"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              className={item === page ? pageButtonActiveClass : pageButtonClass}
              type="button"
              aria-current={item === page ? "page" : undefined}
              onClick={() => onPage(item)}
            >
              {item + 1}
            </button>
          ),
        )}
        <button
          className={pageButtonClass}
          type="button"
          disabled={page >= pageCount - 1}
          onClick={() => onPage(page + 1)}
        >
          Sau
        </button>
      </div>
    </nav>
  );
}
