import { useCallback, useEffect, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import DateRangeFilter from "../components/DateRangeFilter";
import GlobalNav from "../components/GlobalNav";
import OrderEntryDialog from "../components/OrderEntryDialog";
import { useToast } from "../components/Toast";
import {
  clearOrdersAtom,
  dateFromAtom,
  dateToAtom,
  filteredOrdersAtom,
  getOrderTypeLabel,
  normalizeOrderCode,
  ORDER_TYPES,
  orderKey,
  ordersAtom,
  removeOrderAtom,
  removeOrdersByKeysAtom,
  updateOrderAtom,
} from "../orders";

const primaryButtonClass =
  "h-11 cursor-pointer rounded-full border-0 bg-primary px-[22px] py-[11px] text-[17px] font-normal leading-none tracking-[-0.374px] text-white hover:bg-primary-focus focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary-focus active:scale-95 disabled:cursor-default disabled:opacity-[0.64]";

const textLinkClass =
  "cursor-pointer border-0 bg-transparent p-0 text-sm font-normal leading-[1.29] tracking-[-0.224px] text-primary";

const selectChevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%231d1d1f' d='M1.2 1.3 6 6.1l4.8-4.8'/%3E%3C/svg%3E\")";

const compactFieldClass =
  "h-11 w-full rounded-full border border-black/8 bg-canvas px-4 text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink outline-none focus:border-primary-focus focus:shadow-[0_0_0_2px_#0071e3]";

const compactSelectClass = `${compactFieldClass} appearance-none bg-[length:12px_8px] bg-[position:right_14px_center] bg-no-repeat pr-10`;

const orderListCols =
  "desk:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.55fr)_minmax(0,1fr)_minmax(0,0.5fr)_minmax(0,0.55fr)_minmax(0,1fr)_auto]";

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatEnteredAt(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function EmptyValue({ label }) {
  return (
    <span className="col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px]">
      <span className="desk:hidden">{label} </span>
      —
    </span>
  );
}

export default function Dashboard() {
  const notify = useToast();
  const orders = useAtomValue(ordersAtom);
  const visibleOrders = useAtomValue(filteredOrdersAtom);
  const dateFrom = useAtomValue(dateFromAtom);
  const dateTo = useAtomValue(dateToAtom);
  const hasDateRange = Boolean(dateFrom || dateTo);
  const removeOrder = useSetAtom(removeOrderAtom);
  const removeOrdersByKeys = useSetAtom(removeOrdersByKeysAtom);
  const updateOrder = useSetAtom(updateOrderAtom);
  const clearOrders = useSetAtom(clearOrdersAtom);
  const [entryOpen, setEntryOpen] = useState(false);
  const closeEntry = useCallback(() => setEntryOpen(false), []);
  const [editingKey, setEditingKey] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editType, setEditType] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editError, setEditError] = useState("");
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const draggingRef = useRef(false);
  const anchorIndexRef = useRef(-1);
  const ordersRef = useRef(visibleOrders);
  ordersRef.current = visibleOrders;

  useEffect(() => {
    document.title = "Nhập đơn hàng";
    return () => {
      document.title = "Order";
    };
  }, []);

  useEffect(() => {
    const valid = new Set(
      visibleOrders.map((order) => orderKey(order.code, order.type)),
    );
    setSelectedKeys((current) => {
      const next = new Set([...current].filter((key) => valid.has(key)));
      return next.size === current.size ? current : next;
    });
  }, [visibleOrders]);

  useEffect(() => {
    function selectRange(from, to) {
      const list = ordersRef.current;
      const start = Math.min(from, to);
      const end = Math.max(from, to);
      const keys = list
        .slice(start, end + 1)
        .map((order) => orderKey(order.code, order.type));
      setSelectedKeys(new Set(keys));
    }

    function handlePointerMove(event) {
      if (!draggingRef.current || anchorIndexRef.current < 0) return;
      const node = document.elementFromPoint(event.clientX, event.clientY);
      const row = node?.closest("[data-order-index]");
      if (!row) return;
      const index = Number(row.getAttribute("data-order-index"));
      if (Number.isNaN(index)) return;
      selectRange(anchorIndexRef.current, index);
    }

    function handlePointerUp() {
      draggingRef.current = false;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  function handleRemove(code, type) {
    if (editingKey === orderKey(code, type)) {
      setEditingKey("");
      setEditError("");
    }
    removeOrder(code, type);
    notify(`Đã xóa ${code}.`);
  }

  function handleClearSelection() {
    setSelectedKeys(new Set());
    notify("Đã bỏ chọn.");
  }

  function handleRemoveSelected() {
    const count = selectedKeys.size;
    if (count === 0) return;
    removeOrdersByKeys(selectedKeys);
    setSelectedKeys(new Set());
    setEditingKey("");
    setEditError("");
    notify(`Đã xóa ${count} đơn hàng.`);
  }

  function handleRowPointerDown(event, index, key) {
    if (event.button !== 0) return;
    if (event.target.closest("button, input, select, textarea, a")) return;
    if (editingKey) return;

    event.preventDefault();
    draggingRef.current = true;

    if (event.shiftKey && anchorIndexRef.current >= 0) {
      const list = ordersRef.current;
      const start = Math.min(anchorIndexRef.current, index);
      const end = Math.max(anchorIndexRef.current, index);
      setSelectedKeys(
        new Set(
          list
            .slice(start, end + 1)
            .map((order) => orderKey(order.code, order.type)),
        ),
      );
      return;
    }

    anchorIndexRef.current = index;
    if (event.ctrlKey || event.metaKey) {
      setSelectedKeys((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      return;
    }

    setSelectedKeys(new Set([key]));
  }

  function handleClear() {
    setEditingKey("");
    setEditError("");
    setSelectedKeys(new Set());
    clearOrders();
    notify("Đã xóa toàn bộ đơn hàng.");
  }

  function handleStartEdit(order) {
    setEditingKey(orderKey(order.code, order.type));
    setEditCode(order.code);
    setEditType(order.type ?? "");
    setEditNote(order.note ?? "");
    setEditError("");
  }

  function handleCancelEdit() {
    setEditingKey("");
    setEditError("");
  }

  function handleSaveEdit(order) {
    const result = updateOrder(order.code, order.type, {
      code: editCode,
      type: editType,
      note: editNote,
    });
    if (result.error) {
      setEditError(result.error);
      notify(result.error, "error");
      return;
    }
    setEditingKey("");
    setEditError("");
    notify(`Đã cập nhật ${normalizeOrderCode(editCode)}.`);
  }

  return (
    <div className="min-h-screen bg-parchment">
      <GlobalNav />

      <main className="mx-auto max-w-[1200px] px-6 py-12 tablet:px-8 tablet:py-20">

        <div className="flex flex-col gap-6 tablet:flex-row tablet:items-end tablet:justify-between">
          <div>
            <h1 className="m-0 font-sans text-[34px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink desk:text-[40px]">
              Nhập mã CO
            </h1>
            <p className="mt-4 max-w-[28ch] font-sans text-[21px] font-normal leading-[1.19] tracking-[0.196px] text-ink-muted-80 desk:text-[28px] desk:leading-[1.14]">
              Mỗi dòng một mã CO
            </p>
          </div>
          <button
            className={primaryButtonClass}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={entryOpen}
            onClick={() => setEntryOpen(true)}
          >
            Nhập đơn
          </button>
        </div>

        <section
          className={`mt-10 ${selectedKeys.size ? "pb-24" : ""}`}
          aria-labelledby="order-list-heading"
        >
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2
              id="order-list-heading"
              className="m-0 font-sans text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-ink"
            >
              Đơn đã nhập
              {visibleOrders.length ? (
                <span className="ml-2 font-normal text-ink-muted-48">
                  {visibleOrders.length}
                </span>
              ) : null}
            </h2>
            {orders.length ? (
              <button
                className={textLinkClass}
                type="button"
                onClick={handleClear}
              >
                Xóa tất cả
              </button>
            ) : null}
          </div>

          <div className="mb-4">
            <DateRangeFilter />
          </div>

          {orders.length === 0 ? (
            <p className="m-0 text-[17px] leading-[1.44] tracking-[-0.374px] text-ink-muted-48">
              Chưa có đơn hàng.
            </p>
          ) : visibleOrders.length === 0 ? (
            <p className="m-0 text-[17px] leading-[1.44] tracking-[-0.374px] text-ink-muted-48">
              {hasDateRange
                ? "Không có đơn trong khoảng ngày đã chọn."
                : "Chưa có đơn hàng."}
            </p>
          ) : (
            <ul className="m-0 list-none overflow-hidden rounded-[18px] border border-hairline bg-canvas p-0 select-none">
              <li className={`hidden border-b border-hairline px-6 py-3 text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink-muted-48 desk:grid ${orderListCols} desk:gap-4`}>
                <span>Mã đơn</span>
                <span>Công đoạn</span>
                <span>Mã nhân viên</span>
                <span>Thời gian</span>
                <span>Số giây</span>
                <span>Tổng CO</span>
                <span>Ghi chú</span>
                <span>Thao tác</span>
              </li>
              {visibleOrders.map((order, index) => {
                const key = orderKey(order.code, order.type);
                const isEditing = editingKey === key;
                const isSelected = selectedKeys.has(key);
                return (
                  <li
                    key={key}
                    data-order-index={index}
                    data-order-key={key}
                    aria-selected={isSelected}
                    onPointerDown={(event) => handleRowPointerDown(event, index, key)}
                    className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 px-6 py-[17px] ${orderListCols} desk:items-center ${
                      isSelected ? "bg-[#e8f1fb]" : "bg-canvas"
                    } ${index < visibleOrders.length - 1 ? "border-b border-hairline" : ""}`}
                  >
                    {isEditing ? (
                      <input
                        className={`${compactFieldClass} tabular-nums`}
                        value={editCode}
                        onChange={(event) => {
                          setEditCode(event.target.value.toUpperCase());
                          if (editError) setEditError("");
                        }}
                        spellCheck={false}
                        autoCapitalize="characters"
                        aria-label="Mã đơn"
                      />
                    ) : (
                      <span className="text-[17px] font-normal tracking-[-0.374px] text-ink tabular-nums">
                        {order.code}
                      </span>
                    )}
                    {isEditing ? (
                      <select
                        className={`${compactSelectClass} col-start-1 desk:col-start-auto`}
                        style={{ backgroundImage: selectChevron }}
                        value={editType}
                        onChange={(event) => {
                          setEditType(event.target.value);
                          if (editError) setEditError("");
                        }}
                        aria-label="Công đoạn"
                      >
                        <option value="">Chọn công đoạn</option>
                        {ORDER_TYPES.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink">
                        {getOrderTypeLabel(order.type)}
                      </span>
                    )}
                    <span className="col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px]">
                      <span className="desk:hidden">Mã NV </span>
                      {order.employeeId || "—"}
                    </span>
                    <span className="col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px]">
                      {formatEnteredAt(order.updatedAt || order.createdAt)}
                    </span>
                    <EmptyValue label="Số giây" />
                    <EmptyValue label="Tổng CO" />
                    {isEditing ? (
                      <input
                        className={`${compactFieldClass} col-start-1 desk:col-start-auto`}
                        value={editNote}
                        onChange={(event) => setEditNote(event.target.value)}
                        aria-label="Ghi chú"
                        placeholder="Ghi chú"
                      />
                    ) : (
                      <span className="col-start-1 break-words text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink">
                        {order.note ? (
                          order.note
                        ) : (
                          <>
                            <span className="desk:hidden">Ghi chú </span>
                            —
                          </>
                        )}
                      </span>
                    )}
                    <div className="col-start-2 row-start-1 flex items-center gap-4 self-center desk:col-start-auto desk:row-start-auto">
                      {isEditing ? (
                        <>
                          <button
                            className={textLinkClass}
                            type="button"
                            onClick={() => handleSaveEdit(order)}
                          >
                            Lưu
                          </button>
                          <button
                            className={textLinkClass}
                            type="button"
                            onClick={handleCancelEdit}
                          >
                            Hủy
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className={textLinkClass}
                            type="button"
                            onClick={() => handleStartEdit(order)}
                          >
                            Sửa
                          </button>
                          <button
                            className={textLinkClass}
                            type="button"
                            onClick={() => handleRemove(order.code, order.type)}
                          >
                            Xóa
                          </button>
                        </>
                      )}
                    </div>
                    {isEditing && editError ? (
                      <p
                        className="col-span-2 m-0 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-warn desk:col-span-8"
                        role="alert"
                      >
                        {editError}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <OrderEntryDialog open={entryOpen} onClose={closeEntry} />

      {selectedKeys.size > 0 ? (
        <div className="fixed bottom-8 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-4 py-2 text-white">
          <span className="whitespace-nowrap px-2 text-[15px] font-normal leading-none tracking-[-0.224px]">
            {selectedKeys.size} đơn đã chọn
          </span>
          <button
            className="h-9 cursor-pointer rounded-full border-0 bg-white/15 px-4 text-sm font-normal leading-none tracking-[-0.224px] text-white hover:bg-white/25"
            type="button"
            onClick={handleClearSelection}
          >
            Bỏ chọn
          </button>
          <button
            className="h-9 cursor-pointer rounded-full border-0 bg-[#e30000] px-4 text-sm font-normal leading-none tracking-[-0.224px] text-white hover:bg-[#c40000] active:scale-95"
            type="button"
            onClick={handleRemoveSelected}
          >
            Xóa đã chọn
          </button>
        </div>
      ) : null}
    </div>
  );
}
