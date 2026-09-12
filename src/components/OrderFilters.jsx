import { useAtom, useAtomValue } from "jotai";
import {
  dateFromAtom,
  dateToAtom,
  hasActiveFiltersAtom,
  ORDER_TYPES,
  orderTypeFilterAtom,
  searchQueryAtom,
} from "../orders";

const fieldClass =
  "h-11 w-full rounded-full border border-black/8 bg-canvas px-5 text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink outline-none focus:border-primary-focus focus:shadow-[0_0_0_2px_#0071e3]";

const selectChevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%231d1d1f' d='M1.2 1.3 6 6.1l4.8-4.8'/%3E%3C/svg%3E\")";

const selectClass = `${fieldClass} appearance-none bg-[length:12px_8px] bg-[position:right_20px_center] bg-no-repeat pr-12`;

export default function OrderFilters() {
  const [query, setQuery] = useAtom(searchQueryAtom);
  const [type, setType] = useAtom(orderTypeFilterAtom);
  const [from, setFrom] = useAtom(dateFromAtom);
  const [to, setTo] = useAtom(dateToAtom);
  const hasFilters = useAtomValue(hasActiveFiltersAtom);

  function handleFrom(value) {
    setFrom(value);
    if (value && to && value > to) setTo(value);
  }

  function handleTo(value) {
    setTo(value);
    if (value && from && value < from) setFrom(value);
  }

  function handleClear() {
    setQuery("");
    setType("");
    setFrom("");
    setTo("");
  }

  return (
    <div className="flex flex-col gap-3 tablet:flex-row tablet:flex-wrap tablet:items-end">
      <label className="flex min-w-0 flex-1 flex-col gap-2 tablet:min-w-[220px] desk:flex-[1.4]">
        <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
          Tìm kiếm
        </span>
        <input
          className={fieldClass}
          type="search"
          name="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Mã đơn, mã NV, ghi chú"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-2 tablet:min-w-[180px]">
        <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
          Công đoạn
        </span>
        <select
          className={selectClass}
          style={{ backgroundImage: selectChevron }}
          name="orderTypeFilter"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="">Tất cả</option>
          {ORDER_TYPES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-2 tablet:min-w-[160px]">
        <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
          Từ ngày
        </span>
        <input
          className={`${fieldClass} tabular-nums`}
          type="date"
          name="fromDate"
          value={from}
          max={to || undefined}
          onChange={(event) => handleFrom(event.target.value)}
        />
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-2 tablet:min-w-[160px]">
        <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
          Đến ngày
        </span>
        <input
          className={`${fieldClass} tabular-nums`}
          type="date"
          name="toDate"
          value={to}
          min={from || undefined}
          onChange={(event) => handleTo(event.target.value)}
        />
      </label>
      {hasFilters ? (
        <button
          className="h-11 shrink-0 cursor-pointer self-start border-0 bg-transparent px-1 text-sm font-normal leading-[1.29] tracking-[-0.224px] text-primary tablet:self-auto"
          type="button"
          onClick={handleClear}
        >
          Xóa lọc
        </button>
      ) : null}
    </div>
  );
}
