import { useAtom, useAtomValue } from "jotai";
import {
  dateFromAtom,
  dateToAtom,
  hasActiveFiltersAtom,
  ORDER_TYPES,
  orderKindFilterAtom,
  orderTypeFilterAtom,
  searchQueryAtom,
  unmatchedSearchAtom,
} from "../orders";

const fieldClass =
  "h-11 w-full rounded-full border border-black/8 bg-canvas px-5 text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink outline-none focus:border-primary-focus focus:shadow-[0_0_0_2px_#0071e3]";

const searchClass =
  "min-h-[88px] w-full resize-y rounded-[18px] border border-black/8 bg-canvas px-5 py-3 font-sans text-[17px] font-normal leading-[1.47] tracking-[-0.374px] text-ink outline-none tabular-nums focus:border-primary-focus focus:shadow-[0_0_0_2px_#0071e3]";

const selectChevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%231d1d1f' d='M1.2 1.3 6 6.1l4.8-4.8'/%3E%3C/svg%3E\")";

const selectClass = `${fieldClass} appearance-none bg-[length:12px_8px] bg-[position:right_20px_center] bg-no-repeat pr-12`;

export default function OrderFilters() {
  const [query, setQuery] = useAtom(searchQueryAtom);
  const [type, setType] = useAtom(orderTypeFilterAtom);
  const [kind, setKind] = useAtom(orderKindFilterAtom);
  const [from, setFrom] = useAtom(dateFromAtom);
  const [to, setTo] = useAtom(dateToAtom);
  const hasFilters = useAtomValue(hasActiveFiltersAtom);
  const unmatched = useAtomValue(unmatchedSearchAtom);

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
    setKind("");
    setFrom("");
    setTo("");
  }

  return (
    <div className="flex flex-col gap-3 tablet:flex-row tablet:flex-wrap tablet:items-start">
      <label className="flex min-w-0 flex-1 flex-col gap-2 tablet:min-w-[220px] desk:flex-[1.4]">
        <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
          Tìm kiếm
        </span>
        <textarea
          className={searchClass}
          name="search"
          rows={3}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={"Mã CO, mã PD, mã NV, ghi chú\nMỗi dòng một mã"}
          autoComplete="off"
          spellCheck={false}
        />
        {unmatched.length ? (
          <span className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-warn">
            Không thấy {unmatched.length} mã: {unmatched.slice(0, 8).join(", ")}
            {unmatched.length > 8 ? `… (+${unmatched.length - 8})` : ""}
          </span>
        ) : null}
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-2 tablet:min-w-[260px] desk:flex-[1.6]">
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
      <label className="flex min-w-0 flex-1 flex-col gap-2 tablet:min-w-[140px]">
        <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
          Loại mã
        </span>
        <select
          className={selectClass}
          style={{ backgroundImage: selectChevron }}
          name="orderKindFilter"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          <option value="">Tất cả</option>
          <option value="co">Mã CO</option>
          <option value="pd">Mã PD</option>
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
          className="h-11 shrink-0 cursor-pointer self-start border-0 bg-transparent px-1 text-sm font-normal leading-[1.29] tracking-[-0.224px] text-primary tablet:mt-7"
          type="button"
          onClick={handleClear}
        >
          Xóa lọc
        </button>
      ) : null}
    </div>
  );
}
