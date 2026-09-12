import { useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  filterOrdersByQuery,
  getOrderTypeLabel,
  normalizeOrderCode,
  orderKey,
  ordersAtom,
  updateOrderSecondsAtom,
} from "../orders";
import {
  getOrderSeconds,
  parseSecondsInput,
  typeSecondsAtom,
} from "../settings";
import { useToast } from "./Toast";

const RESULT_LIMIT = 8;

const primaryButtonClass =
  "h-11 cursor-pointer rounded-full border-0 bg-primary px-[22px] py-[11px] text-[17px] font-normal leading-none tracking-[-0.374px] text-white hover:bg-primary-focus focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary-focus active:scale-95 disabled:cursor-default disabled:opacity-[0.64]";

const ghostButtonClass =
  "h-11 cursor-pointer rounded-full border-0 bg-transparent px-[18px] py-[11px] text-[17px] font-normal leading-none tracking-[-0.374px] text-primary hover:bg-black/4";

const textFieldClass =
  "h-11 w-full rounded-full border border-black/8 bg-canvas px-5 text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink outline-none focus:border-primary-focus focus:shadow-[0_0_0_2px_#0071e3]";

function sameOrder(left, right) {
  return Boolean(
    left &&
      right &&
      left.code === right.code &&
      left.type === right.type,
  );
}

export default function SecondsEditDialog({ open, onClose }) {
  const notify = useToast();
  const orders = useAtomValue(ordersAtom);
  const typeSeconds = useAtomValue(typeSecondsAtom);
  const saveSeconds = useSetAtom(updateOrderSecondsAtom);
  const searchRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [value, setValue] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected(null);
      setValue("");
      setFormError("");
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKey(event) {
      if (event.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", handleKey);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const matches = useMemo(() => {
    return filterOrdersByQuery(orders, query);
  }, [orders, query]);

  const visibleMatches = matches.slice(0, RESULT_LIMIT);

  function selectOrder(order) {
    setSelected(order);
    setQuery(order.code);
    const seconds = getOrderSeconds(order, typeSeconds);
    setValue(seconds == null ? "" : String(seconds));
    setFormError("");
  }

  function handleQueryChange(nextQuery) {
    setQuery(nextQuery);
    if (
      selected &&
      normalizeOrderCode(nextQuery) !== selected.code
    ) {
      setSelected(null);
      setValue("");
    }
    if (formError) setFormError("");
  }

  function resolveOrder() {
    if (selected) {
      return (
        orders.find(
          (order) =>
            order.code === selected.code && order.type === selected.type,
        ) ?? selected
      );
    }
    if (matches.length === 1) return matches[0];
    const exactCode = normalizeOrderCode(query);
    if (!exactCode) return null;
    const exact = orders.filter((order) => order.code === exactCode);
    return exact.length === 1 ? exact[0] : null;
  }

  if (!open) return null;

  function handleSubmit(event) {
    event.preventDefault();
    const order = resolveOrder();
    if (!order) {
      const message = query.trim()
        ? "Chọn một mã CO đã nhập."
        : "Tìm và chọn mã CO đã nhập.";
      setFormError(message);
      notify(message, "error");
      return;
    }

    const parsed = parseSecondsInput(value);
    if (parsed.error) {
      setFormError(parsed.error);
      notify(parsed.error, "error");
      return;
    }

    const result = saveSeconds(order.code, order.type, parsed.value);
    if (result.error) {
      setFormError(result.error);
      notify(result.error, "error");
      return;
    }

    notify(`Đã lưu số giây cho ${order.code}.`);
    onClose();
  }

  const showResults = !selected && orders.length > 0;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 tablet:items-center tablet:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[18px] border border-hairline bg-canvas p-6 shadow-product tablet:max-w-[560px] tablet:rounded-[18px] tablet:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="seconds-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2
            id="seconds-dialog-title"
            className="m-0 font-sans text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-ink"
          >
            Thiết lập số giây
          </h2>
          <button className={ghostButtonClass} type="button" onClick={onClose}>
            Đóng
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6 flex flex-col gap-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
                Tìm CO đã nhập
              </span>
              <input
                ref={searchRef}
                className={`${textFieldClass} tabular-nums`}
                type="search"
                name="orderSearch"
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
                placeholder="Mã đơn, mã NV, công đoạn"
                autoComplete="off"
                spellCheck={false}
                aria-describedby="order-search-help"
                aria-controls="order-search-results"
              />
            </label>
            <span
              id="order-search-help"
              className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-48"
            >
              {orders.length === 0
                ? "Chưa có đơn hàng. Nhập CO trước khi thiết lập số giây."
                : selected
                  ? `${selected.code} · ${getOrderTypeLabel(selected.type)}`
                  : matches.length
                    ? `${Math.min(matches.length, RESULT_LIMIT)}${
                        matches.length > RESULT_LIMIT
                          ? ` / ${matches.length}`
                          : ""
                      } mã CO.`
                    : "Không có CO khớp."}
            </span>
            {showResults ? (
              <ul
                id="order-search-results"
                className="m-0 max-h-48 list-none overflow-y-auto rounded-[18px] border border-hairline p-0"
                role="listbox"
                aria-label="CO đã nhập"
              >
                {visibleMatches.length === 0 ? (
                  <li className="px-5 py-3 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-48">
                    Không có CO khớp.
                  </li>
                ) : (
                  visibleMatches.map((order, index) => {
                    const key = orderKey(order.code, order.type);
                    const active = sameOrder(selected, order);
                    return (
                      <li
                        key={key}
                        className={
                          index < visibleMatches.length - 1
                            ? "border-b border-hairline"
                            : ""
                        }
                      >
                        <button
                          className={`flex w-full cursor-pointer flex-col items-start gap-1 border-0 bg-transparent px-5 py-3 text-left ${
                            active ? "bg-[#e8f1fb]" : "hover:bg-parchment"
                          }`}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => selectOrder(order)}
                        >
                          <span className="text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink tabular-nums">
                            {order.code}
                          </span>
                          <span className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-48">
                            {getOrderTypeLabel(order.type)}
                            {order.employeeId ? ` · NV ${order.employeeId}` : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            ) : null}
          </div>

          {selected ? (
            <label className="mb-6 flex flex-col gap-2">
              <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
                Công đoạn
              </span>
              <input
                className={`${textFieldClass} bg-parchment`}
                type="text"
                value={getOrderTypeLabel(selected.type)}
                readOnly
                aria-readonly="true"
              />
            </label>
          ) : null}

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
              Số giây
            </span>
            <input
              className={`${textFieldClass} tabular-nums`}
              name="seconds"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(event) => {
                setValue(event.target.value.replace(/\D/g, "").slice(0, 5));
                if (formError) setFormError("");
              }}
              placeholder="Không bắt buộc"
              aria-describedby="seconds-dialog-help"
            />
            <span
              id="seconds-dialog-help"
              className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-48"
            >
              Để trống nếu đơn này chưa có định mức.
            </span>
          </label>

          {formError ? (
            <p
              className="mt-4 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-warn"
              role="alert"
            >
              {formError}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button className={primaryButtonClass} type="submit">
              Lưu
            </button>
            <button className={ghostButtonClass} type="button" onClick={onClose}>
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
