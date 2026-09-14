import { useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { isManagerAtom, sessionAtom } from "../auth";
import {
  accessibleOrdersAtom,
  addOrdersAtom,
  allowsPdCodes,
  filterOrdersByQuery,
  ORDER_TYPES,
  getOrderKind,
  parseOrderLines,
  recordKey,
  updateOrderSecondsAtom,
  updateOrdersSecondsAtom,
} from "../orders";
import {
  parseSecondsInput,
  saveCodeSecondsAtom,
  saveOneCodeSecondsAtom,
  saveOneTypeSecondsAtom,
} from "../settings";
import { useToast } from "./Toast";

const SCOPES = [
  { id: "all", label: "Tất cả mã đơn" },
  { id: "selected", label: "Chọn từng mã" },
];

const PD_SCOPE = { id: "pd", label: "Mã PD mới" };

const textareaClass =
  "min-h-[120px] w-full resize-y rounded-[18px] border border-black/8 bg-canvas px-5 py-4 font-sans text-[17px] font-normal leading-[1.47] tracking-[-0.374px] text-ink outline-none tabular-nums focus:border-primary-focus focus:shadow-[0_0_0_2px_#0071e3]";

const primaryButtonClass =
  "h-11 cursor-pointer rounded-full border-0 bg-primary px-[22px] py-[11px] text-[17px] font-normal leading-none tracking-[-0.374px] text-white hover:bg-primary-focus focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary-focus active:scale-95 disabled:cursor-default disabled:opacity-[0.64]";

const ghostButtonClass =
  "h-11 cursor-pointer rounded-full border-0 bg-transparent px-[18px] py-[11px] text-[17px] font-normal leading-none tracking-[-0.374px] text-primary hover:bg-black/4";

const textLinkClass =
  "cursor-pointer border-0 bg-transparent p-0 text-sm font-normal leading-[1.29] tracking-[-0.224px] text-primary";

const selectChevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%231d1d1f' d='M1.2 1.3 6 6.1l4.8-4.8'/%3E%3C/svg%3E\")";

const selectClass =
  "h-11 w-full appearance-none rounded-full border border-black/8 bg-canvas bg-[length:12px_8px] bg-[position:right_20px_center] bg-no-repeat px-5 pr-12 text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink outline-none focus:border-primary-focus focus:shadow-[0_0_0_2px_#0071e3]";

const textFieldClass =
  "h-11 w-full rounded-full border border-black/8 bg-canvas px-5 text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink outline-none focus:border-primary-focus focus:shadow-[0_0_0_2px_#0071e3]";

export default function SecondsEditDialog({ open, onClose, entry = null }) {
  const notify = useToast();
  const isManager = useAtomValue(isManagerAtom);
  const session = useAtomValue(sessionAtom);
  const orders = useAtomValue(accessibleOrdersAtom);
  const addOrders = useSetAtom(addOrdersAtom);
  const saveTypeSeconds = useSetAtom(saveOneTypeSecondsAtom);
  const saveOrderSeconds = useSetAtom(updateOrderSecondsAtom);
  const saveOrdersSeconds = useSetAtom(updateOrdersSecondsAtom);
  const saveCodeSeconds = useSetAtom(saveCodeSecondsAtom);
  const saveOneCodeSeconds = useSetAtom(saveOneCodeSecondsAtom);
  const typeRef = useRef(null);
  const secondsRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isEdit = Boolean(entry);
  const [orderType, setOrderType] = useState("");
  const [scope, setScope] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [value, setValue] = useState("");
  const [pdText, setPdText] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!open) {
      setOrderType("");
      setScope("all");
      setQuery("");
      setSelectedKeys(new Set());
      setValue("");
      setPdText("");
      setFormError("");
      return undefined;
    }

    if (entry?.kind === "type") {
      setOrderType(entry.type.id);
      setScope("all");
      setQuery("");
      setSelectedKeys(new Set());
      setValue(entry.type.seconds == null ? "" : String(entry.type.seconds));
      setPdText("");
    } else if (entry?.kind === "order") {
      setOrderType(entry.order.type);
      setScope("selected");
      setQuery("");
      setSelectedKeys(new Set([recordKey(entry.order)]));
      setValue(
        entry.order.seconds == null ? "" : String(entry.order.seconds),
      );
      setPdText("");
    } else if (entry?.kind === "code") {
      setOrderType(entry.type);
      setScope("pd");
      setQuery("");
      setSelectedKeys(new Set());
      setValue(entry.seconds == null ? "" : String(entry.seconds));
      setPdText(entry.code);
    } else {
      setOrderType("");
      setScope("all");
      setQuery("");
      setSelectedKeys(new Set());
      setValue("");
      setPdText("");
    }
    setFormError("");

    const frame = window.requestAnimationFrame(() => {
      if (entry) {
        secondsRef.current?.focus();
        secondsRef.current?.select();
      } else {
        typeRef.current?.focus();
      }
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
  }, [open, entry]);

  const typeOrders = useMemo(() => {
    if (!orderType) return [];
    return orders.filter((order) => order.type === orderType);
  }, [orders, orderType]);

  const visibleOrders = useMemo(
    () => filterOrdersByQuery(typeOrders, query),
    [typeOrders, query],
  );

  const pdPreview = useMemo(() => parseOrderLines(pdText), [pdText]);
  const pdAllowed = allowsPdCodes(orderType);
  const scopes = pdAllowed
    ? [SCOPES[0], PD_SCOPE]
    : SCOPES;

  if (!open || !isManager) return null;

  function toggleKey(key) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    if (formError) setFormError("");
  }

  function handleSelectVisible(selectAll) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      for (const order of visibleOrders) {
        const key = recordKey(order);
        if (selectAll) next.add(key);
        else next.delete(key);
      }
      return next;
    });
    if (formError) setFormError("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!orderType) {
      setFormError("Chọn công đoạn.");
      notify("Chọn công đoạn.", "error");
      return;
    }

    const parsed = parseSecondsInput(value);
    if (parsed.error) {
      setFormError(parsed.error);
      notify(parsed.error, "error");
      return;
    }
    if (parsed.value == null) {
      setFormError("Nhập thời gian hoàn thành.");
      notify("Nhập thời gian hoàn thành.", "error");
      return;
    }

    if (scope === "all") {
      const overrideKeys = typeOrders
        .filter(
          (order) =>
            typeof order.seconds === "number" && Number.isFinite(order.seconds),
        )
        .map((order) => recordKey(order));
      if (overrideKeys.length) {
        const cleared = saveOrdersSeconds(overrideKeys, null);
        if (cleared.error) {
          setFormError(cleared.error);
          notify(cleared.error, "error");
          return;
        }
      }
      const result = saveTypeSeconds(orderType, value);
      if (result.error) {
        setFormError(result.error);
        notify(result.error, "error");
        return;
      }
      const label =
        ORDER_TYPES.find((item) => item.id === orderType)?.label ?? "công đoạn";
      notify(`Đã lưu số giây cho tất cả mã của ${label}.`);
      onClose();
      return;
    }

    if (isEdit && entry?.kind === "order") {
      const result = saveOrderSeconds(
        entry.order.code,
        entry.order.type,
        parsed.value,
        getOrderKind(entry.order),
      );
      if (result.error) {
        setFormError(result.error);
        notify(result.error, "error");
        return;
      }
      notify(`Đã lưu số giây cho ${entry.order.code}.`);
      onClose();
      return;
    }

    if (isEdit && entry?.kind === "code") {
      const result = saveOneCodeSeconds(entry.code, entry.type, value);
      if (result.error) {
        setFormError(result.error);
        notify(result.error, "error");
        return;
      }
      notify(`Đã lưu số giây cho ${entry.code}.`);
      onClose();
      return;
    }

    if (scope === "pd") {
      if (!pdAllowed) {
        setFormError("Công đoạn này không dùng mã PD.");
        notify("Công đoạn này không dùng mã PD.", "error");
        return;
      }
      if (pdPreview.valid.length === 0) {
        setFormError("Nhập ít nhất một mã PD, mỗi dòng một mã.");
        notify("Nhập ít nhất một mã PD.", "error");
        return;
      }
      const result = saveCodeSeconds(orderType, pdPreview.valid, value);
      if (result.error) {
        setFormError(result.error);
        notify(result.error, "error");
        return;
      }
      const created = addOrders(
        result.codes,
        session?.employeeId,
        orderType,
        "",
        parsed.value,
        "pd",
      );
      const parts = [];
      if (created.added.length) {
        parts.push(`Đã thêm ${created.added.length} mã PD.`);
      }
      if (created.duplicates.length) {
        parts.push(`Đã cập nhật ${created.duplicates.length} mã đã có.`);
      }
      parts.push(`Đã lưu số giây cho ${result.codes.length} mã PD.`);
      notify(parts.join(" "));
      onClose();
      return;
    }

    if (selectedKeys.size === 0) {
      setFormError("Chọn ít nhất một mã đơn.");
      notify("Chọn ít nhất một mã đơn.", "error");
      return;
    }

    const result = saveOrdersSeconds(selectedKeys, parsed.value);
    if (result.error) {
      setFormError(result.error);
      notify(result.error, "error");
      return;
    }
    notify(`Đã lưu số giây cho ${selectedKeys.size} mã đơn.`);
    onClose();
  }

  const typeLabel =
    ORDER_TYPES.find((item) => item.id === orderType)?.label ?? "";

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
            {isEdit ? "Sửa thời gian hoàn thành" : "Thêm mới"}
          </h2>
          <button className={ghostButtonClass} type="button" onClick={onClose}>
            Đóng
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="mb-6 flex flex-col gap-2">
            <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
              Công đoạn
            </span>
            {isEdit ? (
              <input
                className={`${textFieldClass} bg-parchment`}
                type="text"
                value={typeLabel}
                readOnly
                aria-readonly="true"
              />
            ) : (
              <select
                ref={typeRef}
                className={selectClass}
                style={{ backgroundImage: selectChevron }}
                name="orderType"
                value={orderType}
                onChange={(event) => {
                  const nextType = event.target.value;
                  setOrderType(nextType);
                  setSelectedKeys(new Set());
                  setQuery("");
                  if (
                    (scope === "pd" && !allowsPdCodes(nextType)) ||
                    (scope === "selected" && allowsPdCodes(nextType))
                  ) {
                    setScope("all");
                  }
                  if (formError) setFormError("");
                }}
                required
                aria-required="true"
              >
                <option value="">Chọn công đoạn</option>
                {ORDER_TYPES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            )}
          </label>

          <div className="mb-6 flex flex-col gap-2">
            <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
              Áp dụng
            </span>
            {isEdit ? (
              <input
                className={`${textFieldClass} bg-parchment`}
                type="text"
                value={
                  scope === "all"
                    ? "Tất cả mã đơn"
                    : entry?.kind === "code"
                      ? entry.code
                      : entry?.order?.code ?? ""
                }
                readOnly
                aria-readonly="true"
              />
            ) : (
              <div
                className={`grid gap-1 border border-black/8 bg-canvas p-1 ${
                  scopes.length === 3
                    ? "grid-cols-1 auto-rows-[44px] rounded-[18px] tablet:h-11 tablet:grid-cols-3 tablet:auto-rows-auto tablet:rounded-full"
                    : "h-11 grid-cols-2 rounded-full"
                }`}
                role="radiogroup"
                aria-label="Áp dụng"
              >
                {scopes.map((item) => {
                  const selected = scope === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`h-full cursor-pointer rounded-full border-0 px-1 text-[13px] font-normal leading-none tracking-[-0.224px] tablet:text-[15px] ${
                        selected
                          ? "bg-ink text-white"
                          : "bg-transparent text-ink-muted-80 hover:text-ink"
                      }`}
                      onClick={() => {
                        setScope(item.id);
                        if (formError) setFormError("");
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {!isEdit && scope === "pd" && pdAllowed ? (
            <label className="mb-6 flex flex-col gap-2">
              <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
                Mã PD
              </span>
              <textarea
                className={textareaClass}
                name="pdCodes"
                value={pdText}
                onChange={(event) => {
                  setPdText(event.target.value);
                  if (formError) setFormError("");
                }}
                spellCheck={false}
                autoCapitalize="characters"
                placeholder={"PD001\nPD002"}
                aria-describedby="pd-help"
              />
              <span
                id="pd-help"
                className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-48"
              >
                {pdPreview.valid.length
                  ? `${pdPreview.valid.length} mã PD.`
                  : "Mỗi dòng một mã PD."}
              </span>
            </label>
          ) : null}

          {!isEdit && scope === "selected" && orderType ? (
            <div className="mb-6 flex flex-col gap-2">
              <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
                Mã đơn
              </span>
              {typeOrders.length === 0 ? (
                <p className="m-0 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-48">
                  Chưa có đơn ở công đoạn này.
                </p>
              ) : (
                <>
                  <input
                    className={`${textFieldClass} tabular-nums`}
                    type="search"
                    name="orderSearch"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Tìm mã đơn"
                  />
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-48">
                      {selectedKeys.size} đã chọn
                    </span>
                    <div className="flex items-center gap-4">
                      <button
                        className={textLinkClass}
                        type="button"
                        onClick={() => handleSelectVisible(true)}
                      >
                        Chọn tất cả
                      </button>
                      <button
                        className={textLinkClass}
                        type="button"
                        onClick={() => handleSelectVisible(false)}
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>
                  <ul className="m-0 max-h-48 list-none overflow-y-auto rounded-[18px] border border-hairline p-0">
                    {visibleOrders.length === 0 ? (
                      <li className="px-5 py-3 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-48">
                        Không có mã khớp.
                      </li>
                    ) : (
                      visibleOrders.map((order, index) => {
                        const key = recordKey(order);
                        const checked = selectedKeys.has(key);
                        return (
                          <li
                            key={key}
                            className={
                              index < visibleOrders.length - 1
                                ? "border-b border-hairline"
                                : ""
                            }
                          >
                            <label
                              className={`flex cursor-pointer items-center gap-3 px-5 py-3 ${
                                checked ? "bg-[#e8f1fb]" : "hover:bg-parchment"
                              }`}
                            >
                              <input
                                className="h-4 w-4 shrink-0 accent-primary"
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleKey(key)}
                              />
                              <span className="text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink tabular-nums">
                                {order.code}
                              </span>
                            </label>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </>
              )}
            </div>
          ) : null}

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
              Thời gian hoàn thành (giây)
            </span>
            <input
              ref={secondsRef}
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
              required
              aria-required="true"
            />
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
