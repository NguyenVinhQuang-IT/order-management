import { useCallback, useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { Link, useParams } from "react-router-dom";
import { api, mapOrder } from "../api";
import { CopyColumnBar, useColumnCopy } from "../copyColumn";
import {
  employeesAtom,
  getEmployee,
  getEmployeeName,
  getRoleLabel,
} from "../auth";
import GlobalNav from "../components/GlobalNav";
import OrderFilters from "../components/OrderFilters";
import OrderPager from "../components/OrderPager";
import {
  ChartCard,
  DonutChart,
  ExpandableDayChart,
} from "../components/StatsCharts";
import {
  buildOrderListQuery,
  buildStatsQuery,
  daySeriesFromStats,
  emptyServerStats,
  getOrderTypeLabel,
  mapServerStats,
  ORDERS_PAGE_SIZE,
  recordKey,
  secondsSummaryFromStats,
} from "../orders";
import {
  codeSecondsAtom,
  formatCount,
  formatSeconds,
  getOrderSeconds,
  typeSecondsAtom,
} from "../settings";
import { useDebouncedFilters } from "../useOrderList";

const TYPE_COPY_COLUMNS = [
  { id: "type", label: "Công đoạn" },
  { id: "count", label: "Đơn" },
  { id: "seconds", label: "Số giây" },
];

const ORDER_COPY_COLUMNS = [
  { id: "code", label: "Mã" },
  { id: "type", label: "Công đoạn" },
  { id: "seconds", label: "Giây" },
  { id: "time", label: "Thời gian" },
  { id: "note", label: "Ghi chú" },
];

const typeTableCols =
  "desk:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,0.7fr)]";

const textLinkClass =
  "cursor-pointer border-0 bg-transparent p-0 text-sm font-normal leading-[1.29] tracking-[-0.224px] text-primary no-underline";

const orderListCols =
  "desk:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.5fr)_minmax(0,1fr)_minmax(0,1fr)]";

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatEnteredAt(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function typeColumnValue(item, columnId) {
  if (columnId === "type") return item.label || "";
  if (columnId === "count") return item.count == null ? "" : String(item.count);
  if (columnId === "seconds") return item.seconds == null ? "" : String(item.seconds);
  return "";
}

function MetricCard({ label, value }) {
  return (
    <article className="rounded-[18px] border border-hairline bg-canvas p-6">
      <p className="m-0 text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink-muted-48">
        {label}
      </p>
      <p className="mt-3 font-sans text-[34px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink tabular-nums desk:text-[40px]">
        {value}
      </p>
    </article>
  );
}

export default function EmployeeDetail() {
  const { employeeId: rawId = "" } = useParams();
  const employeeId = decodeURIComponent(rawId);
  const employees = useAtomValue(employeesAtom);
  const account = getEmployee(employeeId, employees);
  const name = account?.name || getEmployeeName(employeeId, employees);
  const roleLabel = account ? getRoleLabel(account.role) : "—";
  const filters = useDebouncedFilters();
  const hasDateRange = Boolean(filters.from || filters.to);
  const typeSeconds = useAtomValue(typeSecondsAtom);
  const codeSeconds = useAtomValue(codeSecondsAtom);
  const [page, setPage] = useState(0);
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(emptyServerStats);
  const [ready, setReady] = useState(false);
  const secondsByType = useMemo(
    () => secondsSummaryFromStats(stats.byType),
    [stats.byType],
  );
  const days = useMemo(
    () => daySeriesFromStats(stats.byDay, filters.from, filters.to),
    [stats.byDay, filters.from, filters.to],
  );
  const pageCount = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  const known = Boolean(account || total > 0 || orders.length > 0);
  const emptyMessage = !ready
    ? "Đang tải."
    : total === 0 && filters.hasActiveFilters
      ? "Không có đơn khớp với bộ lọc."
      : "Nhân viên này chưa có đơn hàng.";
  const typeRows = secondsByType.items.filter((item) => item.count > 0);
  const getTypeKey = useCallback((item) => item.id, []);
  const getOrderKey = useCallback((order) => recordKey(order), []);
  const typeCopy = useColumnCopy({
    tableId: "employee-type",
    rows: typeRows,
    getRowKey: getTypeKey,
    columns: TYPE_COPY_COLUMNS,
    getValue: typeColumnValue,
  });
  const orderColumnValue = useCallback(
    (order, columnId) => {
      if (columnId === "code") return order.code || "";
      if (columnId === "type") return getOrderTypeLabel(order.type);
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
    },
    [typeSeconds, codeSeconds],
  );
  const orderCopy = useColumnCopy({
    tableId: "employee-orders",
    rows: orders,
    getRowKey: getOrderKey,
    columns: ORDER_COPY_COLUMNS,
    getValue: orderColumnValue,
  });

  useEffect(() => {
    setPage(0);
  }, [employeeId, filters.query, filters.type, filters.kind, filters.from, filters.to]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    const listFilters = {
      q: filters.query,
      type: filters.type,
      kind: filters.kind,
      from: filters.from,
      to: filters.to,
      page,
      empId: employeeId,
    };
    Promise.all([
      api("/orders", { query: buildOrderListQuery(listFilters) }),
      api("/stats", {
        query: buildStatsQuery(listFilters, { emp_id: employeeId }),
      }),
    ])
      .then(([listed, summary]) => {
        if (cancelled) return;
        const nextPage = Math.max(0, (Number(listed.page) || 1) - 1);
        setOrders((listed.items || []).map(mapOrder));
        setTotal(Number(listed.total || 0));
        setStats(mapServerStats(summary));
        if (nextPage !== page) setPage(nextPage);
      })
      .catch(() => {
        if (cancelled) return;
        setOrders([]);
        setTotal(0);
        setStats(emptyServerStats);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [
    employeeId,
    page,
    filters.query,
    filters.type,
    filters.kind,
    filters.from,
    filters.to,
  ]);

  useEffect(() => {
    document.title = name !== "—" ? name : `NV ${employeeId}`;
    return () => {
      document.title = "Order";
    };
  }, [name, employeeId]);

  return (
    <div className="min-h-screen bg-parchment">
      <GlobalNav />

      <main className="mx-auto max-w-[1200px] px-6 py-12 tablet:px-8 tablet:py-20">
        <Link to="/nhan-vien" className={textLinkClass}>
          Nhân viên
        </Link>

        <h1 className="mt-4 m-0 font-sans text-[34px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink desk:text-[40px]">
          {known ? (name !== "—" ? `${name}.` : `${employeeId}.`) : "Không tìm thấy."}
        </h1>
        <p className="mt-4 max-w-[34ch] font-sans text-[21px] font-normal leading-[1.19] tracking-[0.196px] text-ink-muted-80 desk:text-[28px] desk:leading-[1.14]">
          {known
            ? [
                employeeId,
                account?.pbb || null,
                account?.pba || null,
                roleLabel !== "—" ? roleLabel : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Nhân viên này không có trong hệ thống."}
        </p>

        {known ? (
          <>
            <div className="mt-8">
              <OrderFilters />
            </div>

            <section
              className="mt-8 grid grid-cols-1 gap-4 tablet:grid-cols-2 desk:grid-cols-4"
              aria-label="Chỉ số"
            >
              <MetricCard label="Đơn đã nhập" value={formatCount(stats.total)} />
              <MetricCard label="Mã CO" value={formatCount(stats.uniqueCoCodes)} />
              <MetricCard label="Mã PD" value={formatCount(stats.uniquePdCodes)} />
              <MetricCard
                label="Tổng số giây"
                value={formatSeconds(secondsByType.total)}
              />
            </section>

            <section
              className="mt-4 grid grid-cols-1 gap-4 desk:grid-cols-3"
              aria-label="Biểu đồ"
            >
              <ChartCard title="Tỷ lệ theo công đoạn">
                <DonutChart items={stats.byType} total={stats.total} />
              </ChartCard>
              <ExpandableDayChart
                className="desk:col-span-2"
                title={hasDateRange ? "Đơn theo ngày" : "Đơn 14 ngày gần đây"}
                items={days}
              />
            </section>

            <section className="mt-12" aria-labelledby="employee-type-heading">
              <h2
                id="employee-type-heading"
                className="m-0 mb-4 font-sans text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-ink"
              >
                Theo công đoạn
              </h2>
              {stats.total === 0 ? (
                <p className="m-0 text-[17px] leading-[1.44] tracking-[-0.374px] text-ink-muted-48">
                  {emptyMessage}
                </p>
              ) : (
                <ul className="m-0 list-none overflow-hidden rounded-[18px] border border-hairline bg-canvas p-0 select-none">
                  <li
                    className={`hidden border-b border-hairline px-6 py-3 text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink-muted-48 desk:grid ${typeTableCols} desk:gap-4`}
                  >
                    {TYPE_COPY_COLUMNS.map((column) => (
                      <button
                        key={column.id}
                        className={typeCopy.headerClass(column.id)}
                        type="button"
                        title={`Chọn cột ${column.label}`}
                        aria-pressed={
                          typeCopy.selectedColumn === column.id &&
                          typeCopy.selectedKeys.size > 0
                        }
                        onClick={() => typeCopy.handleSelectColumn(column)}
                      >
                        {column.label}
                      </button>
                    ))}
                  </li>
                  {typeRows.map((item, index) => {
                    const key = item.id;
                    return (
                    <li
                      key={key}
                      data-copy-table="employee-type"
                      data-copy-index={index}
                      onPointerDown={(event) =>
                        typeCopy.handleRowPointerDown(event, index, key)
                      }
                      className={`grid cursor-cell grid-cols-1 gap-y-2 px-6 py-[17px] ${typeTableCols} desk:items-center desk:gap-4 border-b border-hairline`}
                    >
                      <span
                        data-column="type"
                        className={typeCopy.cellClass(
                          key,
                          "type",
                          "text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink",
                        )}
                      >
                        {item.label}
                      </span>
                      <span
                        data-column="count"
                        className={typeCopy.cellClass(
                          key,
                          "count",
                          "text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink",
                        )}
                      >
                        <span className="desk:hidden">Đơn </span>
                        {formatCount(item.count)}
                      </span>
                      <span
                        data-column="seconds"
                        className={typeCopy.cellClass(
                          key,
                          "seconds",
                          "text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink",
                        )}
                      >
                        <span className="desk:hidden">Số giây </span>
                        {formatSeconds(item.seconds)}
                      </span>
                    </li>
                    );
                  })}
                  <li
                    className={`grid grid-cols-1 gap-y-2 px-6 py-[17px] ${typeTableCols} desk:items-center desk:gap-4`}
                  >
                    <span className="text-[17px] font-semibold leading-[1.44] tracking-[-0.374px] text-ink">
                      Tổng
                    </span>
                    <span className="text-sm font-semibold leading-[1.43] tracking-[-0.224px] text-ink tabular-nums desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px]">
                      <span className="desk:hidden">Đơn </span>
                      {formatCount(secondsByType.totalCount)}
                    </span>
                    <span className="text-sm font-semibold leading-[1.43] tracking-[-0.224px] text-ink tabular-nums desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px]">
                      <span className="desk:hidden">Số giây </span>
                      {formatSeconds(secondsByType.total)}
                    </span>
                  </li>
                </ul>
              )}
            </section>

            <section className="mt-12" aria-labelledby="employee-orders-heading">
              <h2
                id="employee-orders-heading"
                className="m-0 mb-4 font-sans text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-ink"
              >
                Đơn đã nhập
                {total ? (
                  <span className="ml-2 font-normal text-ink-muted-48">
                    {total}
                  </span>
                ) : null}
              </h2>
              {orders.length === 0 ? (
                <p className="m-0 text-[17px] leading-[1.44] tracking-[-0.374px] text-ink-muted-48">
                  {emptyMessage}
                </p>
              ) : (
                <ul className="m-0 list-none overflow-hidden rounded-[18px] border border-hairline bg-canvas p-0 select-none">
                  <li
                    className={`hidden border-b border-hairline px-6 py-3 text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink-muted-48 desk:grid ${orderListCols} desk:gap-4`}
                  >
                    {ORDER_COPY_COLUMNS.map((column) => (
                      <button
                        key={column.id}
                        className={orderCopy.headerClass(column.id)}
                        type="button"
                        title={`Chọn cột ${column.label}`}
                        aria-pressed={
                          orderCopy.selectedColumn === column.id &&
                          orderCopy.selectedKeys.size > 0
                        }
                        onClick={() => orderCopy.handleSelectColumn(column)}
                      >
                        {column.label}
                      </button>
                    ))}
                  </li>
                  {orders.map((order, index) => {
                    const key = recordKey(order);
                    return (
                    <li
                      key={key}
                      data-copy-table="employee-orders"
                      data-copy-index={index}
                      onPointerDown={(event) =>
                        orderCopy.handleRowPointerDown(event, index, key)
                      }
                      className={`grid cursor-cell grid-cols-1 gap-y-2 px-6 py-[17px] ${orderListCols} desk:items-center desk:gap-4 ${
                        index < orders.length - 1 ? "border-b border-hairline" : ""
                      }`}
                    >
                      <span
                        data-column="code"
                        className={orderCopy.cellClass(
                          key,
                          "code",
                          "text-[17px] font-normal tracking-[-0.374px] text-ink tabular-nums",
                        )}
                      >
                        {order.code}
                      </span>
                      <span
                        data-column="type"
                        className={orderCopy.cellClass(
                          key,
                          "type",
                          "text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink",
                        )}
                      >
                        {getOrderTypeLabel(order.type)}
                      </span>
                      <span
                        data-column="seconds"
                        className={orderCopy.cellClass(
                          key,
                          "seconds",
                          "text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink",
                        )}
                      >
                        <span className="desk:hidden">Giây </span>
                        {formatSeconds(
                          getOrderSeconds(order, typeSeconds, codeSeconds),
                        )}
                      </span>
                      <span
                        data-column="time"
                        className={orderCopy.cellClass(
                          key,
                          "time",
                          "text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px]",
                        )}
                      >
                        {formatEnteredAt(order.updatedAt || order.createdAt)}
                      </span>
                      <span
                        data-column="note"
                        className={orderCopy.cellClass(
                          key,
                          "note",
                          "break-words text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink",
                        )}
                      >
                        {order.note || "—"}
                      </span>
                    </li>
                    );
                  })}
                </ul>
              )}
              <OrderPager
                page={page}
                pageCount={pageCount}
                total={total}
                pageSize={ORDERS_PAGE_SIZE}
                shown={orders.length}
                onPage={setPage}
              />
            </section>
          </>
        ) : null}
      </main>
      {typeCopy.showBar ? (
        <CopyColumnBar
          count={typeCopy.selectedKeys.size}
          label={typeCopy.selectedLabel}
          onCopy={() => typeCopy.handleCopyColumn()}
          onClear={typeCopy.handleClearSelection}
        />
      ) : null}
      {orderCopy.showBar ? (
        <CopyColumnBar
          count={orderCopy.selectedKeys.size}
          label={orderCopy.selectedLabel}
          onCopy={() => orderCopy.handleCopyColumn()}
          onClear={orderCopy.handleClearSelection}
        />
      ) : null}
    </div>
  );
}
