import { Link } from "react-router-dom";
import { employeePath, getRoleLabel } from "../auth";

const tableCols =
  "desk:grid-cols-[minmax(0,0.7fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.55fr)_auto]";

const textLinkClass =
  "text-sm font-normal leading-[1.29] tracking-[-0.224px] text-primary";

export default function EmployeeDirectory({ rows, empty }) {
  if (!rows.length) {
    return (
      <p className="m-0 text-[17px] leading-[1.44] tracking-[-0.374px] text-ink-muted-48">
        {empty}
      </p>
    );
  }

  return (
    <ul className="m-0 list-none overflow-hidden rounded-[18px] border border-hairline bg-canvas p-0">
      <li
        className={`hidden border-b border-hairline px-6 py-3 text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink-muted-48 desk:grid ${tableCols} desk:gap-4`}
      >
        <span>Mã NV</span>
        <span>Tên</span>
        <span>Vai trò</span>
        <span>Đơn</span>
        <span>Thao tác</span>
      </li>
      {rows.map((row, index) => (
        <li
          key={row.employeeId}
          className={index < rows.length - 1 ? "border-b border-hairline" : ""}
        >
          <Link
            to={employeePath(row.employeeId)}
            className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-6 py-[17px] no-underline ${tableCols} hover:bg-[#f5f5f7]`}
          >
            <span className="text-[17px] font-normal tracking-[-0.374px] text-ink tabular-nums">
              {row.employeeId}
            </span>
            <span className="col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink">
              <span className="desk:hidden">Tên </span>
              {row.name}
            </span>
            <span className="col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink">
              <span className="desk:hidden">Vai trò </span>
              {getRoleLabel(row.role)}
            </span>
            <span className="col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink">
              <span className="desk:hidden">Đơn </span>
              {row.count}
            </span>
            <span
              className={`${textLinkClass} col-start-2 row-start-1 self-center desk:col-start-auto desk:row-start-auto`}
            >
              Xem
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
