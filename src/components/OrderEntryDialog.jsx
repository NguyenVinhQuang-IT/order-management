import { useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { isManagerAtom, sessionAtom } from "../auth";
import {
  addOrdersAtom,
  getOrderKind,
  MAX_ORDERS_PER_ENTRY,
  normalizeOrderCode,
  ORDER_TYPES,
  parseOrderLines,
  updateOrderAtom,
  updateOrderSecondsAtom,
} from "../orders";
import {
  codeSecondsAtom,
  getOrderSeconds,
  parseSecondsInput,
  typeSecondsAtom,
} from "../settings";
import { useToast } from "./Toast";

const primaryButtonClass =
  "h-11 cursor-pointer rounded-full border-0 bg-primary px-[22px] py-[11px] text-[17px] font-normal leading-none tracking-[-0.374px] text-white hover:bg-primary-focus focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary-focus active:scale-95 disabled:cursor-default disabled:opacity-[0.64]";

const ghostButtonClass =
  "h-11 cursor-pointer rounded-full border-0 bg-transparent px-[18px] py-[11px] text-[17px] font-normal leading-none tracking-[-0.374px] text-primary hover:bg-black/4";

const selectChevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%231d1d1f' d='M1.2 1.3 6 6.1l4.8-4.8'/%3E%3C/svg%3E\")";

const selectClass =
  "h-11 w-full appearance-none rounded-full border border-black/8 bg-canvas bg-[length:12px_8px] bg-[position:right_20px_center] bg-no-repeat px-5 pr-12 text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink outline-none focus:border-primary-focus focus:shadow-[0_0_0_2px_#0071e3]";

const textFieldClass =
  "h-11 w-full rounded-full border border-black/8 bg-canvas px-5 text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink outline-none focus:border-primary-focus focus:shadow-[0_0_0_2px_#0071e3]";

export default function OrderEntryDialog({ open, onClose, order = null }) {
  const notify = useToast();
  const session = useAtomValue(sessionAtom);
  const isManager = useAtomValue(isManagerAtom);
  const typeSeconds = useAtomValue(typeSecondsAtom);
  const codeSeconds = useAtomValue(codeSecondsAtom);
  const addOrders = useSetAtom(addOrdersAtom);
  const updateOrder = useSetAtom(updateOrderAtom);
  const saveOrderSeconds = useSetAtom(updateOrderSecondsAtom);
  const firstFieldRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isEdit = Boolean(order);
  const [text, setText] = useState("");
  const [orderType, setOrderType] = useState("");
  const [note, setNote] = useState("");
  const [seconds, setSeconds] = useState("");
  const [formError, setFormError] = useState("");
  const preview = useMemo(() => parseOrderLines(text), [text]);

  useEffect(() => {
    if (!open) {
      setText("");
      setOrderType("");
      setNote("");
      setSeconds("");
      setFormError("");
      return undefined;
    }

    setText(order?.code ?? "");
    setOrderType(order?.type ?? "");
    setNote(order?.note ?? "");
    const resolved = order
      ? getOrderSeconds(order, typeSeconds, codeSeconds)
      : null;
    setSeconds(resolved == null ? "" : String(resolved));
    setFormError("");

    const frame = window.requestAnimationFrame(() => {
      firstFieldRef.current?.focus();
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
  }, [open, order, typeSeconds, codeSeconds]);

  if (!open) return null;

  function handleSubmit(event) {
    event.preventDefault();

    if (!orderType) {
      setFormError("Chọn công đoạn.");
      notify("Chọn công đoạn.", "error");
      return;
    }

    if (isEdit) {
      const code = normalizeOrderCode(text);
      if (!code) {
        setFormError("Nhập mã đơn.");
        notify("Nhập mã đơn.", "error");
        return;
      }

      let parsedSeconds = { value: null, error: "" };
      if (isManager) {
        parsedSeconds = parseSecondsInput(seconds);
        if (parsedSeconds.error) {
          setFormError(parsedSeconds.error);
          notify(parsedSeconds.error, "error");
          return;
        }
      }

      const result = updateOrder(order.code, order.type, {
        code,
        type: orderType,
        note,
        kind: getOrderKind(order),
      });
      if (result.error) {
        setFormError(result.error);
        notify(result.error, "error");
        return;
      }
      if (isManager) {
        const secondsResult = saveOrderSeconds(
          code,
          orderType,
          parsedSeconds.value,
          getOrderKind(order),
        );
        if (secondsResult.error) {
          setFormError(secondsResult.error);
          notify(secondsResult.error, "error");
          return;
        }
      }
      notify(`Đã cập nhật ${code}.`);
      onClose();
      return;
    }

    const { valid } = parseOrderLines(text);
    if (valid.length === 0) {
      setFormError("Nhập ít nhất một mã đơn, mỗi dòng một mã.");
      notify("Nhập ít nhất một mã đơn.", "error");
      return;
    }
    if (valid.length > MAX_ORDERS_PER_ENTRY) {
      const message = `Mỗi lần nhập tối đa ${MAX_ORDERS_PER_ENTRY} đơn.`;
      setFormError(message);
      notify(message, "error");
      return;
    }

    const result = addOrders(valid, session?.employeeId, orderType, note);
    if (result.error) {
      setFormError(result.error);
      notify(result.error, "error");
      return;
    }
    const parts = [];
    if (result.added.length) {
      parts.push(`Đã nhập ${result.added.length} đơn hàng.`);
    }
    if (result.duplicates.length) {
      parts.push(`Bỏ qua ${result.duplicates.length} mã trùng.`);
    }
    notify(parts.join(" ") || "Không có đơn mới để nhập.");
    onClose();
  }

  function handleKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      handleSubmit(event);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 tablet:items-center tablet:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[18px] border border-hairline bg-canvas p-6 shadow-product tablet:max-w-[560px] tablet:rounded-[18px] tablet:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2
            id="entry-dialog-title"
            className="m-0 font-sans text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-ink"
          >
            {isEdit ? "Sửa đơn" : "Nhập đơn"}
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
            <select
              ref={firstFieldRef}
              className={selectClass}
              style={{ backgroundImage: selectChevron }}
              name="orderType"
              value={orderType}
              onChange={(event) => {
                setOrderType(event.target.value);
                if (formError) setFormError("");
              }}
            >
              <option value="">Chọn công đoạn</option>
              {ORDER_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          {isEdit ? (
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
                {getOrderKind(order) === "pd" ? "Mã PD" : "Mã CO"}
              </span>
              <input
                className={`${textFieldClass} tabular-nums`}
                name="orderCode"
                type="text"
                value={text}
                onChange={(event) => {
                  setText(event.target.value.toUpperCase());
                  if (formError) setFormError("");
                }}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoCapitalize="characters"
                placeholder={
                  getOrderKind(order) === "pd" ? "PD001" : "CO26090405992"
                }
              />
            </label>
          ) : (
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
                Danh sách mã đơn
              </span>
              <textarea
                className="min-h-[200px] w-full resize-y rounded-[18px] border border-black/8 bg-canvas px-5 py-4 font-sans text-[17px] font-normal leading-[1.47] tracking-[-0.374px] text-ink outline-none tabular-nums focus:border-primary-focus focus:shadow-[0_0_0_2px_#0071e3]"
                name="orders"
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  if (formError) setFormError("");
                }}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoCapitalize="characters"
                placeholder={"CO26090405992\nCO26090405991\nCO26090405990"}
                aria-describedby="order-help"
              />
              <span
                id="order-help"
                className={`text-sm font-normal leading-[1.43] tracking-[-0.224px] ${
                  preview.valid.length > MAX_ORDERS_PER_ENTRY
                    ? "text-warn"
                    : "text-ink-muted-48"
                }`}
              >
                {preview.valid.length
                  ? preview.valid.length > MAX_ORDERS_PER_ENTRY
                    ? `${preview.valid.length} mã đơn. Tối đa ${MAX_ORDERS_PER_ENTRY} mã một lần.`
                    : `${preview.valid.length} mã đơn.`
                  : `Dán mã đơn, mỗi dòng một mã. Tối đa ${MAX_ORDERS_PER_ENTRY} mã một lần.`}
              </span>
            </label>
          )}

          {isEdit && isManager ? (
            <label className="mt-6 flex flex-col gap-2">
              <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
                Thời gian hoàn thành (giây)
              </span>
              <input
                className={`${textFieldClass} tabular-nums`}
                name="seconds"
                type="text"
                inputMode="numeric"
                value={seconds}
                onChange={(event) => {
                  setSeconds(event.target.value);
                  if (formError) setFormError("");
                }}
                onKeyDown={handleKeyDown}
                placeholder="Không bắt buộc"
              />
            </label>
          ) : null}

          <label className="mt-6 flex flex-col gap-2">
            <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
              Ghi chú
            </span>
            <input
              className={textFieldClass}
              name="note"
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Không bắt buộc"
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
              {isEdit ? "Lưu" : "Nhập đơn"}
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
