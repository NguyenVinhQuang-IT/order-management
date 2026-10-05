import { useEffect, useRef, useState } from "react";
import { atom, useAtom } from "jotai";
import { useToast } from "./components/Toast";

export const headerCopyClass =
  "cursor-pointer border-0 bg-transparent p-0 text-left text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink-muted-48 hover:text-primary";

const activeCopyTableAtom = atom("");

export async function writeClipboard(text) {
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

function columnFromEvent(event) {
  const cell = event.target.closest("[data-column]");
  return cell?.getAttribute("data-column") || null;
}

export function useColumnCopy({
  tableId,
  rows,
  getRowKey,
  columns,
  getValue,
}) {
  const notify = useToast();
  const [activeTable, setActiveTable] = useAtom(activeCopyTableAtom);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [selectedColumn, setSelectedColumn] = useState(columns[0]?.id || "");
  const draggingRef = useRef(false);
  const anchorIndexRef = useRef(-1);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const isActive = activeTable === tableId;

  useEffect(() => {
    const valid = new Set(rows.map((row) => getRowKey(row)));
    setSelectedKeys((current) => {
      const next = new Set([...current].filter((key) => valid.has(key)));
      return next.size === current.size ? current : next;
    });
  }, [rows, getRowKey]);

  useEffect(() => {
    if (!isActive && selectedKeys.size) {
      setSelectedKeys(new Set());
    }
  }, [isActive, selectedKeys.size]);

  function selectRange(from, to) {
    const list = rowsRef.current;
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    setSelectedKeys(
      new Set(list.slice(start, end + 1).map((row) => getRowKey(row))),
    );
  }

  useEffect(() => {
    function handlePointerMove(event) {
      if (!draggingRef.current || anchorIndexRef.current < 0) return;
      const node = document.elementFromPoint(event.clientX, event.clientY);
      const row = node?.closest(`[data-copy-table="${tableId}"][data-copy-index]`);
      if (!row) return;
      const index = Number(row.getAttribute("data-copy-index"));
      if (Number.isNaN(index)) return;
      const list = rowsRef.current;
      const start = Math.min(anchorIndexRef.current, index);
      const end = Math.max(anchorIndexRef.current, index);
      setSelectedKeys(
        new Set(list.slice(start, end + 1).map((row) => getRowKey(row))),
      );
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
  }, [tableId, getRowKey]);

  function activate() {
    setActiveTable(tableId);
  }

  function handleRowPointerDown(event, index, key) {
    if (event.button !== 0) return;
    if (event.target.closest("button, input, select, textarea, a")) return;
    const column = columnFromEvent(event);
    if (!column) return;

    event.preventDefault();
    activate();
    draggingRef.current = true;
    const sameColumn = column === selectedColumn;
    setSelectedColumn(column);

    if (event.shiftKey && sameColumn && anchorIndexRef.current >= 0) {
      selectRange(anchorIndexRef.current, index);
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
    activate();
    setSelectedColumn(column.id);
    setSelectedKeys(new Set(rows.map((row) => getRowKey(row))));
    anchorIndexRef.current = 0;
  }

  function handleClearSelection() {
    setSelectedKeys(new Set());
    notify("Đã bỏ chọn.");
  }

  async function handleCopyColumn(column) {
    const active =
      column || columns.find((item) => item.id === selectedColumn) || columns[0];
    if (!active) return;
    const source =
      selectedKeys.size > 0
        ? rows.filter((row) => selectedKeys.has(getRowKey(row)))
        : rows;
    const lines = source.map((row) => getValue(row, active.id) ?? "");
    if (!lines.length) {
      notify("Không có dữ liệu để copy.", "error");
      return;
    }
    try {
      await writeClipboard(lines.join("\n"));
      const scope = selectedKeys.size > 0 ? "đã chọn" : "cột này";
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
      if (!isActive || !selectedKeys.size) return;
      event.preventDefault();
      handleCopyColumn();
    }
    window.addEventListener("keydown", handleCopyShortcut);
    return () => window.removeEventListener("keydown", handleCopyShortcut);
  }, [isActive, selectedKeys, selectedColumn, rows, columns]);

  function isCellSelected(key, columnId) {
    return isActive && selectedKeys.has(key) && selectedColumn === columnId;
  }

  function cellClass(key, columnId, extra) {
    return `${extra} -mx-1 rounded-md px-1 ${
      isCellSelected(key, columnId) ? "bg-[#e8f1fb] text-ink" : ""
    }`;
  }

  function headerClass(columnId) {
    return `${headerCopyClass} ${
      isActive && selectedColumn === columnId && selectedKeys.size ? "text-primary" : ""
    }`;
  }

  const selectedLabel =
    (columns.find((item) => item.id === selectedColumn) || columns[0])?.label || "";

  return {
    selectedKeys,
    selectedColumn,
    selectedLabel,
    handleSelectColumn,
    handleRowPointerDown,
    handleCopyColumn,
    handleClearSelection,
    cellClass,
    headerClass,
    showBar: isActive && selectedKeys.size > 0,
  };
}

export function CopyColumnBar({
  count,
  label,
  onCopy,
  onClear,
}) {
  if (!count) return null;
  return (
    <div className="fixed bottom-8 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-4 py-2 text-white">
      <span className="whitespace-nowrap px-2 text-[15px] font-normal leading-none tracking-[-0.224px]">
        {count} {label.toLowerCase()} đã chọn
      </span>
      <button
        className="h-9 cursor-pointer rounded-full border-0 bg-white/15 px-4 text-sm font-normal leading-none tracking-[-0.224px] text-white hover:bg-white/25"
        type="button"
        onClick={onCopy}
      >
        Copy
      </button>
      <button
        className="h-9 cursor-pointer rounded-full border-0 bg-white/15 px-4 text-sm font-normal leading-none tracking-[-0.224px] text-white hover:bg-white/25"
        type="button"
        onClick={onClear}
      >
        Bỏ chọn
      </button>
    </div>
  );
}
