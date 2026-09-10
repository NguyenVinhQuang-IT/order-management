import { useAtom } from "jotai";
import { dateFromAtom, dateToAtom } from "../orders";

const dateFieldClass =
  "h-11 w-full rounded-full border border-black/8 bg-canvas px-5 text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink outline-none tabular-nums focus:border-primary-focus focus:shadow-[0_0_0_2px_#0071e3]";

export default function DateRangeFilter() {
  const [from, setFrom] = useAtom(dateFromAtom);
  const [to, setTo] = useAtom(dateToAtom);
  const hasRange = Boolean(from || to);

  function handleFrom(value) {
    setFrom(value);
    if (value && to && value > to) setTo(value);
  }

  function handleTo(value) {
    setTo(value);
    if (value && from && value < from) setFrom(value);
  }

  return (
    <div className="flex flex-col gap-3 tablet:flex-row tablet:items-end">
      <label className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
          Từ ngày
        </span>
        <input
          className={dateFieldClass}
          type="date"
          name="fromDate"
          value={from}
          max={to || undefined}
          onChange={(event) => handleFrom(event.target.value)}
        />
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
          Đến ngày
        </span>
        <input
          className={dateFieldClass}
          type="date"
          name="toDate"
          value={to}
          min={from || undefined}
          onChange={(event) => handleTo(event.target.value)}
        />
      </label>
      {hasRange ? (
        <button
          className="h-11 shrink-0 cursor-pointer self-start border-0 bg-transparent px-1 text-sm font-normal leading-[1.29] tracking-[-0.224px] text-primary tablet:self-auto"
          type="button"
          onClick={() => {
            setFrom("");
            setTo("");
          }}
        >
          Xóa lọc
        </button>
      ) : null}
    </div>
  );
}
