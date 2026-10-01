import { useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { api, mapOrder } from "../api";
import { isManagerAtom } from "../auth";
import {
  allowsPdCodes,
  buildOrderListQuery,
  ORDER_TYPES,
  ORDERS_PAGE_SIZE,
  parseOrderLines,
  pickerOrdersAtom,
  recordKey,
} from "../orders";
import DialogOverlay from "./DialogOverlay";
import { SecondsEditFormProvider } from "./seconds-edit/context";
import { getSecondsTypePanel } from "./seconds-edit/registry";
import {
  ghostButtonClass,
  primaryButtonClass,
  selectChevron,
  selectClass,
  textFieldClass,
} from "./seconds-edit/styles";
import { useToast } from "./Toast";

export default function SecondsEditDialog({ open, onClose, entry = null }) {
  const notify = useToast();
  const isManager = useAtomValue(isManagerAtom);
  const setPickerOrders = useSetAtom(pickerOrdersAtom);
  const [typeOrders, setTypeOrders] = useState([]);
  const [pickerTotal, setPickerTotal] = useState(0);
  const [pickerPage, setPickerPage] = useState(0);
  const [pickerLoading, setPickerLoading] = useState(false);
  const typeRef = useRef(null);
  const secondsRef = useRef(null);
  const submitRef = useRef(null);
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

  const visibleOrders = typeOrders;
  const pickerPageCount = Math.max(1, Math.ceil(pickerTotal / ORDERS_PAGE_SIZE));

  useEffect(() => {
    setPickerPage(0);
  }, [orderType, query]);

  useEffect(() => {
    if (!open || !isManager || !orderType) {
      setPickerLoading(false);
      setTypeOrders([]);
      setPickerTotal(0);
      setPickerOrders([]);
      return undefined;
    }
    let cancelled = false;
    setPickerLoading(true);
    const timer = window.setTimeout(() => {
      api("/orders", {
        query: buildOrderListQuery({
          type: orderType,
          q: query,
          page: pickerPage,
        }),
      })
        .then((data) => {
          if (cancelled) return;
          const items = (data.items || []).map(mapOrder);
          const nextPage = Math.max(0, (Number(data.page) || 1) - 1);
          setTypeOrders(items);
          setPickerTotal(Number(data.total || 0));
          setPickerOrders(items);
          if (nextPage !== pickerPage) setPickerPage(nextPage);
        })
        .catch(() => {
          if (cancelled) return;
          setTypeOrders([]);
          setPickerTotal(0);
          setPickerOrders([]);
        })
        .finally(() => {
          if (!cancelled) setPickerLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, isManager, orderType, query, pickerPage, setPickerOrders]);

  const pdPreview = useMemo(() => parseOrderLines(pdText), [pdText]);
  const TypePanel = getSecondsTypePanel(orderType);
  if (!TypePanel) submitRef.current = null;

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

  function handleTypeChange(event) {
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
  }

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
      const message = error.message || "Không thể lưu số giây.";
      setFormError(message);
      notify(message, "error");
    }
  }

  const typeLabel =
    ORDER_TYPES.find((item) => item.id === orderType)?.label ?? "";

  const formValue = {
    isEdit,
    entry,
    orderType,
    typeLabel,
    scope,
    setScope,
    query,
    setQuery,
    selectedKeys,
    typeOrders,
    visibleOrders,
    pdText,
    setPdText,
    pdPreview,
    value,
    setValue,
    formError,
    setFormError,
    secondsRef,
    submitRef,
    notify,
    onClose,
    toggleKey,
    handleSelectVisible,
    pickerPage,
    pickerPageCount,
    pickerTotal,
    pickerLoading,
    setPickerPage,
  };

  return (
    <DialogOverlay onClose={onClose}>
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
                onChange={handleTypeChange}
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

          {TypePanel ? (
            <SecondsEditFormProvider value={formValue}>
              <TypePanel key={orderType} />
            </SecondsEditFormProvider>
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
              Lưu
            </button>
            <button className={ghostButtonClass} type="button" onClick={onClose}>
              Hủy
            </button>
          </div>
        </form>
      </div>
    </DialogOverlay>
  );
}
