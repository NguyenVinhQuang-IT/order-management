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
  MAX_ORDERS_PER_ENTRY,
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
  const TypePanel = getSecondsTypePanel(orderType);

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
      if (pdPreview.valid.length > MAX_ORDERS_PER_ENTRY) {
        const message = `Mỗi lần nhập tối đa ${MAX_ORDERS_PER_ENTRY} đơn.`;
        setFormError(message);
        notify(message, "error");
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
      if (created.error) {
        setFormError(created.error);
        notify(created.error, "error");
        return;
      }
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
    toggleKey,
    handleSelectVisible,
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
    </div>
  );
}
