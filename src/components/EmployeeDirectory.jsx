import { useCallback } from "react";
import { Link } from "react-router-dom";
import { employeePath, getRoleLabel } from "../auth";
import { CopyColumnBar, useColumnCopy } from "../copyColumn";

const COPY_COLUMNS = [
  { id: "employeeId", label: "Mã NV" },
  { id: "name", label: "Tên" },
  { id: "pbb", label: "Mã PBB" },
  { id: "pba", label: "Mã PBA" },
  { id: "role", label: "Vai trò" },
  { id: "count", label: "Đơn" },
];

function columnValue(row, columnId) {
  if (columnId === "employeeId") return row.employeeId || "";
  if (columnId === "name") return row.name || "";
  if (columnId === "pbb") return row.pbb || "";
  if (columnId === "pba") return row.pba || "";
  if (columnId === "role") return getRoleLabel(row.role);
  if (columnId === "count") return row.count == null ? "" : String(row.count);
  return "";
}

const tableCols =
  "desk:grid-cols-[minmax(0,0.5fr)_minmax(0,1fr)_minmax(0,0.55fr)_minmax(0,0.55fr)_minmax(0,0.75fr)_minmax(0,0.35fr)_auto]";

const textLinkClass =
  "cursor-pointer border-0 bg-transparent p-0 text-sm font-normal leading-[1.29] tracking-[-0.224px] text-primary";

export default function EmployeeDirectory({
  rows,
  empty,
  onEdit,
  onDelete,
}) {
  const getRowKey = useCallback((row) => row.employeeId, []);
  const copy = useColumnCopy({
    tableId: "employee-directory",
    rows,
    getRowKey,
    columns: COPY_COLUMNS,
    getValue: columnValue,
  });

  if (!rows.length) {
    return (
      <p className="m-0 text-[17px] leading-[1.44] tracking-[-0.374px] text-ink-muted-48">
        {empty}
      </p>
    );
  }

  return (
    <>
    <ul className="m-0 list-none overflow-hidden rounded-[18px] border border-hairline bg-canvas p-0 select-none">
      <li
        className={`hidden border-b border-hairline px-6 py-3 text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink-muted-48 desk:grid ${tableCols} desk:gap-4`}
      >
        {COPY_COLUMNS.map((column) => (
          <button
            key={column.id}
            className={copy.headerClass(column.id)}
            type="button"
            title={`Chọn cột ${column.label}`}
            aria-pressed={
              copy.selectedColumn === column.id && copy.selectedKeys.size > 0
            }
            onClick={() => copy.handleSelectColumn(column)}
          >
            {column.label}
          </button>
        ))}
        <span>Thao tác</span>
      </li>
      {rows.map((row, index) => {
        const key = row.employeeId;
        return (
        <li
          key={key}
          data-copy-table="employee-directory"
          data-copy-index={index}
          onPointerDown={(event) => copy.handleRowPointerDown(event, index, key)}
          className={`grid cursor-cell grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-6 py-[17px] ${tableCols} ${
            index < rows.length - 1 ? "border-b border-hairline" : ""
          }`}
        >
          <span
            data-column="employeeId"
            className={copy.cellClass(key, "employeeId", "text-[17px] font-normal tracking-[-0.374px] text-ink tabular-nums")}
          >
            {row.employeeId}
          </span>
          <span
            data-column="name"
            className={copy.cellClass(key, "name", "col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink")}
          >
            <span className="desk:hidden">Tên </span>
            {row.name}
          </span>
          <span
            data-column="pbb"
            className={copy.cellClass(key, "pbb", "col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink")}
          >
            <span className="desk:hidden">Mã PBB </span>
            {row.pbb || "—"}
          </span>
          <span
            data-column="pba"
            className={copy.cellClass(key, "pba", "col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink")}
          >
            <span className="desk:hidden">Mã PBA </span>
            {row.pba || "—"}
          </span>
          <span
            data-column="role"
            className={copy.cellClass(key, "role", "col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink")}
          >
            <span className="desk:hidden">Vai trò </span>
            {getRoleLabel(row.role)}
          </span>
          <span
            data-column="count"
            className={copy.cellClass(key, "count", "col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink")}
          >
            <span className="desk:hidden">Đơn </span>
            {row.count}
          </span>
          <div className="col-start-2 row-start-1 flex items-center gap-4 self-center desk:col-start-auto desk:row-start-auto">
            <Link to={employeePath(row.employeeId)} className={textLinkClass}>
              Xem
            </Link>
            {onEdit ? (
              <button
                className={textLinkClass}
                type="button"
                onClick={() => onEdit(row)}
              >
                Sửa
              </button>
            ) : null}
            {onDelete ? (
              <button
                className={textLinkClass}
                type="button"
                onClick={() => onDelete(row)}
              >
                Xóa
              </button>
            ) : null}
          </div>
        </li>
        );
      })}
    </ul>
    {copy.showBar ? (
      <CopyColumnBar
        count={copy.selectedKeys.size}
        label={copy.selectedLabel}
        onCopy={() => copy.handleCopyColumn()}
        onClear={copy.handleClearSelection}
      />
    ) : null}
    </>
  );
}
