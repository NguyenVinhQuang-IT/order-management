import { useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { isManagerAtom } from "../auth";
import { ORDER_TYPES, parseOrderLines } from "../orders";
import {
  codeSecondsAtom,
  getOrderSeconds,
  typeSecondsAtom,
} from "../settings";
import { OrderEntryFormProvider } from "./order-entry/context";
import { getOrderEntryTypePanel } from "./order-entry/registry";
import {
  ghostButtonClass,
  primaryButtonClass,
  selectChevron,
  selectClass,
} from "./order-entry/styles";
import { useToast } from "./Toast";

export default function OrderEntryDialog({ open, onClose, order = null }) {
  const notify = useToast();
  const isManager = useAtomValue(isManagerAtom);
  const typeSeconds = useAtomValue(typeSecondsAtom);
  const codeSeconds = useAtomValue(codeSecondsAtom);
  const firstFieldRef = useRef(null);
  const submitRef = useRef(null);
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

  const TypePanel = getOrderEntryTypePanel(orderType);
  if (!TypePanel) submitRef.current = null;

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!orderType || typeof submitRef.current !== "function") {
      setFormError("Chọn công đoạn.");
      notify("Chọn công đoạn.", "error");
      return;
    }
    try {
      await submitRef.current();
    } catch (error) {
      const message = error.message || "Không thể lưu đơn hàng.";
      setFormError(message);
      notify(message, "error");
    }
  }

  function handleCtrlEnter(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      handleSubmit(event);
    }
  }

  const formValue = {
    isEdit,
    isManager,
    order,
    orderType,
    text,
    setText,
    note,
    setNote,
    seconds,
    setSeconds,
    preview,
    formError,
    setFormError,
    submitRef,
    notify,
    onClose,
    handleCtrlEnter,
  };

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

          {TypePanel ? (
            <OrderEntryFormProvider value={formValue}>
              <TypePanel key={orderType} />
            </OrderEntryFormProvider>
          ) : null}

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
