import { useCallback, useEffect, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { isManagerAtom } from "../auth";
import GlobalNav from "../components/GlobalNav";
import OrderEntryDialog from "../components/OrderEntryDialog";
import OrderFilters from "../components/OrderFilters";
import OrderPager from "../components/OrderPager";
import SecondsEditDialog from "../components/SecondsEditDialog";
import { useToast } from "../components/Toast";
import {
  accessibleOrdersAtom,
  getOrderKind,
  getOrderTypeLabel,
  orderPageAtom,
  ordersLoadingAtom,
  ordersPageSizeAtom,
  ordersTotalAtom,
  recordKey,
  removeOrderAtom,
  removeOrdersByKeysAtom,
} from "../orders";
import { useOrderListLoader } from "../useOrderList";
import {
  codeSecondsAtom,
  formatSeconds,
  getOrderSeconds,
  typeSecondsAtom,
} from "../settings";
const primaryButtonClass =
  "h-11 cursor-pointer rounded-full border-0 bg-primary px-[22px] py-[11px] text-[17px] font-normal leading-none tracking-[-0.374px] text-white hover:bg-primary-focus focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary-focus active:scale-95 disabled:cursor-default disabled:opacity-[0.64]";

const secondaryButtonClass =
  "h-11 cursor-pointer rounded-full border border-black/8 bg-canvas px-[22px] py-[11px] text-[17px] font-normal leading-none tracking-[-0.374px] text-ink hover:bg-black/4 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary-focus active:scale-95";

const textLinkClass =
  "cursor-pointer border-0 bg-transparent p-0 text-sm font-normal leading-[1.29] tracking-[-0.224px] text-primary";

const orderListCols =
  "desk:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.55fr)_minmax(0,0.45fr)_minmax(0,1fr)_minmax(0,1fr)_auto]";

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatEnteredAt(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const COPY_COLUMNS = [
  { id: "code", label: "Mã" },
  { id: "type", label: "Công đoạn" },
  { id: "employeeId", label: "Mã nhân viên" },
  { id: "seconds", label: "Giây" },
  { id: "time", label: "Thời gian" },
  { id: "note", label: "Ghi chú" },
];

const headerCopyClass =
  "cursor-pointer border-0 bg-transparent p-0 text-left text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink-muted-48 hover:text-primary";

async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  document.body.removeChild(area);
}

export default function Dashboard() {
  const notify = useToast();
  const isManager = useAtomValue(isManagerAtom);
  const { hasActiveFilters } = useOrderListLoader();
  const orders = useAtomValue(accessibleOrdersAtom);
  const totalOrders = useAtomValue(ordersTotalAtom);
  const pageSize = useAtomValue(ordersPageSizeAtom);
  const page = useAtomValue(orderPageAtom);
  const setPage = useSetAtom(orderPageAtom);
  const ordersLoading = useAtomValue(ordersLoadingAtom);
  const typeSeconds = useAtomValue(typeSecondsAtom);
  const codeSeconds = useAtomValue(codeSecondsAtom);
  const removeOrder = useSetAtom(removeOrderAtom);
  const removeOrdersByKeys = useSetAtom(removeOrdersByKeysAtom);
  const [entryOpen, setEntryOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [secondsOpen, setSecondsOpen] = useState(false);
  const dialogOpen = entryOpen || Boolean(editingOrder);
  const closeDialog = useCallback(() => {
    setEntryOpen(false);
    setEditingOrder(null);
  }, []);
  const closeSeconds = useCallback(() => {
    setSecondsOpen(false);
  }, []);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [selectedColumn, setSelectedColumn] = useState("code");
  const draggingRef = useRef(false);
  const anchorIndexRef = useRef(-1);
  const dragColumnRef = useRef("code");
  const pageCount = Math.max(1, Math.ceil(totalOrders / pageSize));
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  useEffect(() => {
    document.title = "Nhập đơn hàng";
    return () => {
      document.title = "Order";
    };
  }, []);

  useEffect(() => {
    if (!isManager) closeSeconds();
  }, [isManager, closeSeconds]);

  useEffect(() => {
    const valid = new Set(orders.map((order) => recordKey(order)));
    setSelectedKeys((current) => {
      const next = new Set([...current].filter((key) => valid.has(key)));
      return next.size === current.size ? current : next;
    });
    setEditingOrder((current) =>
      current && !valid.has(recordKey(current))
        ? null
        : current,
    );
  }, [orders]);

  useEffect(() => {
    function selectRange(from, to) {
      const list = ordersRef.current;
      const start = Math.min(from, to);
      const end = Math.max(from, to);
      const keys = list
        .slice(start, end + 1)
        .map((order) => recordKey(order));
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

  async function handleRemove(order) {
    if (editingOrder && recordKey(editingOrder) === recordKey(order)) {
      setEditingOrder(null);
    }
    const result = await removeOrder(order.code, order.type, getOrderKind(order));
    if (result?.error) {
      notify(result.error, "error");
      return;
    }
    notify(`Đã xóa ${order.code}.`);
  }

  function handleClearSelection() {
    setSelectedKeys(new Set());
    notify("Đã bỏ chọn.");
  }

  async function handleRemoveSelected() {
    const count = selectedKeys.size;
    if (count === 0) return;
    const result = await removeOrdersByKeys(selectedKeys);
    if (result?.error) {
      notify(result.error, "error");
      return;
    }
    setSelectedKeys(new Set());
    setEditingOrder(null);
    notify(`Đã xóa ${count} đơn hàng.`);
  }

  function columnFromEvent(event) {
    const cell = event.target.closest("[data-column]");
    return cell?.getAttribute("data-column") || null;
  }

  function handleRowPointerDown(event, index, key) {
    if (event.button !== 0) return;
    if (event.target.closest("button, input, select, textarea, a")) return;
    if (dialogOpen || secondsOpen) return;

    const column = columnFromEvent(event);
    if (!column) return;

    event.preventDefault();
    draggingRef.current = true;
    const sameColumn = column === selectedColumn;
    dragColumnRef.current = column;
    setSelectedColumn(column);

    if (event.shiftKey && sameColumn && anchorIndexRef.current >= 0) {
      const list = ordersRef.current;
      const start = Math.min(anchorIndexRef.current, index);
      const end = Math.max(anchorIndexRef.current, index);
      setSelectedKeys(
        new Set(
          list
            .slice(start, end + 1)
            .map((order) => recordKey(order)),
        ),
      );
      return;
    }

    anchorIndexRef.current = index;
    if ((event.ctrlKey || event.metaKey) && sameColumn) {
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

  function handleSelectColumn(column) {
    setSelectedColumn(column.id);
    dragColumnRef.current = column.id;
    setSelectedKeys(new Set(orders.map((order) => recordKey(order))));
    anchorIndexRef.current = 0;
  }

  function goToPage(next) {
    const clamped = Math.max(0, Math.min(next, pageCount - 1));
    setPage(clamped);
    anchorIndexRef.current = -1;
    document.getElementById("order-list-heading")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function columnValue(order, columnId) {
    if (columnId === "code") return order.code || "";
    if (columnId === "type") return getOrderTypeLabel(order.type);
    if (columnId === "employeeId") return order.employeeId || "";
    if (columnId === "seconds") {
      const seconds = getOrderSeconds(order, typeSeconds, codeSeconds);
      return seconds == null ? "" : String(seconds);
    }
    if (columnId === "time") {
      const text = formatEnteredAt(order.updatedAt || order.createdAt);
      return text === "—" ? "" : text;
    }
    if (columnId === "note") return order.note || "";
    return "";
  }

  async function handleCopyColumn(column) {
    const active = column || COPY_COLUMNS.find((item) => item.id === selectedColumn) || COPY_COLUMNS[0];
    const source =
      selectedKeys.size > 0
        ? orders.filter((order) => selectedKeys.has(recordKey(order)))
        : orders;
    const lines = source.map((order) => columnValue(order, active.id));
    if (!lines.length) {
      notify("Không có dữ liệu để copy.", "error");
      return;
    }
    try {
      await writeClipboard(lines.join("\n"));
      const scope = selectedKeys.size > 0 ? "đã chọn" : "trang này";
      notify(`Đã copy ${lines.length} ${active.label.toLowerCase()} (${scope}).`);
    } catch {
      notify("Không copy được. Hãy cho phép truy cập clipboard.", "error");
    }
  }

  useEffect(() => {
    function handleCopyShortcut(event) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "c") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) {
        return;
      }
      if (!selectedKeys.size) return;
      event.preventDefault();
      handleCopyColumn();
    }
    window.addEventListener("keydown", handleCopyShortcut);
    return () => window.removeEventListener("keydown", handleCopyShortcut);
  }, [selectedKeys, selectedColumn, orders, typeSeconds, codeSeconds]);

  function handleStartEdit(order) {
    setSecondsOpen(false);
    setEntryOpen(false);
    setEditingOrder(order);
  }

  function isCellSelected(key, columnId) {
    return selectedKeys.has(key) && selectedColumn === columnId;
  }

  function cellClass(key, columnId, extra) {
    return `${extra} -mx-1 rounded-md px-1 ${isCellSelected(key, columnId) ? "bg-[#e8f1fb] text-ink" : ""
      }`;
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
          <div className="flex flex-wrap items-center gap-3">
            {isManager ? (
              <button
                className={secondaryButtonClass}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={secondsOpen}
                onClick={() => {
                  setEditingOrder(null);
                  setEntryOpen(false);
                  setSecondsOpen(true);
                }}
              >
                Tùy chỉnh
              </button>
            ) : null}
            <button
              className={primaryButtonClass}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={entryOpen}
              onClick={() => {
                closeSeconds();
                setEditingOrder(null);
                setEntryOpen(true);
              }}
            >
              Nhập đơn
            </button>
          </div>
        </div>

        <section
          className={`mt-10 ${selectedKeys.size ? "pb-24" : ""}`}
          aria-labelledby="order-list-heading"
        >
          <h2
            id="order-list-heading"
            className="m-0 mb-4 font-sans text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-ink"
          >
            Đơn đã nhập
            {totalOrders ? (
              <span className="ml-2 font-normal text-ink-muted-48">
                {totalOrders}
              </span>
            ) : null}
          </h2>

          <div className="mb-4">
            <OrderFilters />
          </div>

          {ordersLoading && orders.length === 0 ? (
            <p className="m-0 text-[17px] leading-[1.44] tracking-[-0.374px] text-ink-muted-48">
              Đang tải.
            </p>
          ) : orders.length === 0 ? (
            <p className="m-0 text-[17px] leading-[1.44] tracking-[-0.374px] text-ink-muted-48">
              {hasActiveFilters
                ? "Không có đơn khớp với bộ lọc."
                : "Chưa có đơn hàng."}
            </p>
          ) : (
            <ul className="m-0 list-none overflow-hidden rounded-[18px] border border-hairline bg-canvas p-0 select-none">
              <li className={`hidden border-b border-hairline px-6 py-3 text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink-muted-48 desk:grid ${orderListCols} desk:gap-4`}>
                {COPY_COLUMNS.map((column) => (
                  <button
                    key={column.id}
                    className={`${headerCopyClass} ${selectedColumn === column.id && selectedKeys.size
                      ? "text-primary"
                      : ""
                      }`}
                    type="button"
                    title={`Chọn cột ${column.label}`}
                    aria-pressed={selectedColumn === column.id && selectedKeys.size > 0}
                    onClick={() => handleSelectColumn(column)}
                  >
                    {column.label}
                  </button>
                ))}
                <span>Thao tác</span>
              </li>
              {orders.map((order, index) => {
                const key = recordKey(order);
                const isSelected = selectedKeys.has(key);
                return (
                  <li
                    key={key}
                    data-order-index={index}
                    data-order-key={key}
                    aria-selected={isSelected}
                    onPointerDown={(event) => handleRowPointerDown(event, index, key)}
                    className={`grid cursor-cell grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 px-6 py-[17px] ${orderListCols} desk:items-center bg-canvas ${index < orders.length - 1 ? "border-b border-hairline" : ""}`}
                  >
                    <span
                      data-column="code"
                      className={cellClass(key, "code", "text-[17px] font-normal tracking-[-0.374px] text-ink tabular-nums")}
                    >
                      {order.code}
                    </span>
                    <span
                      data-column="type"
                      className={cellClass(key, "type", "col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink")}
                    >
                      {getOrderTypeLabel(order.type)}
                    </span>
                    <span
                      data-column="employeeId"
                      className={cellClass(key, "employeeId", "col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px]")}
                    >
                      <span className="desk:hidden">Mã NV </span>
                      {order.employeeId || "—"}
                    </span>
                    <span
                      data-column="seconds"
                      className={cellClass(key, "seconds", "col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink")}
                    >
                      <span className="desk:hidden">Giây </span>
                      {formatSeconds(
                        getOrderSeconds(order, typeSeconds, codeSeconds),
                      )}
                    </span>
                    <span
                      data-column="time"
                      className={cellClass(key, "time", "col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px]")}
                    >
                      {formatEnteredAt(order.updatedAt || order.createdAt)}
                    </span>
                    <span
                      data-column="note"
                      className={cellClass(key, "note", "col-start-1 break-words text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink")}
                    >
                      {order.note ? (
                        order.note
                      ) : (
                        <>
                          <span className="desk:hidden">Ghi chú </span>
                          —
                        </>
                      )}
                    </span>
                    <div className="col-start-2 row-start-1 flex items-center gap-4 self-center desk:col-start-auto desk:row-start-auto">
                      <button
                        className={textLinkClass}
                        type="button"
                        aria-haspopup="dialog"
                        aria-expanded={
                          Boolean(
                            editingOrder &&
                            recordKey(editingOrder) === key,
                          )
                        }
                        onClick={() => handleStartEdit(order)}
                      >
                        Sửa
                      </button>
                      <button
                        className={textLinkClass}
                        type="button"
                        onClick={() => handleRemove(order)}
                      >
                        Xóa
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <OrderPager
            page={page}
            pageCount={pageCount}
            total={totalOrders}
            pageSize={pageSize}
            shown={orders.length}
            onPage={goToPage}
          />
        </section>
      </main>

      <OrderEntryDialog
        open={dialogOpen}
        order={editingOrder}
        onClose={closeDialog}
      />

      {isManager ? (
        <SecondsEditDialog open={secondsOpen} onClose={closeSeconds} />
      ) : null}

      {selectedKeys.size > 0 ? (
        <div className="fixed bottom-8 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-4 py-2 text-white">
          <span className="whitespace-nowrap px-2 text-[15px] font-normal leading-none tracking-[-0.224px]">
            {selectedKeys.size}{" "}
            {(COPY_COLUMNS.find((item) => item.id === selectedColumn) || COPY_COLUMNS[0]).label.toLowerCase()}{" "}
            đã chọn
          </span>
          <button
            className="h-9 cursor-pointer rounded-full border-0 bg-white/15 px-4 text-sm font-normal leading-none tracking-[-0.224px] text-white hover:bg-white/25"
            type="button"
            onClick={() => handleCopyColumn()}
          >
            Copy
          </button>
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
