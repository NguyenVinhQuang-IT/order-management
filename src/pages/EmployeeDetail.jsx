import { useEffect, useMemo } from "react";
import { useAtomValue } from "jotai";
import { Link, useParams } from "react-router-dom";
import {
  getEmployee,
  getEmployeeName,
  getRoleLabel,
} from "../auth";
import GlobalNav from "../components/GlobalNav";
import OrderFilters from "../components/OrderFilters";
import {
  ChartCard,
  DayBarChart,
  DonutChart,
} from "../components/StatsCharts";
import {
  dateFromAtom,
  dateToAtom,
  filteredOrdersAtom,
  getOrderTypeLabel,
  hasActiveFiltersAtom,
  recordKey,
  ordersAtom,
  summarizeOrders,
} from "../orders";
import {
  codeSecondsAtom,
  formatSeconds,
  getOrderSeconds,
  sumSecondsByType,
  typeSecondsAtom,
} from "../settings";

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
  const account = getEmployee(employeeId);
  const name = account?.name || getEmployeeName(employeeId);
  const roleLabel = account ? getRoleLabel(account.role) : "—";
  const orders = useAtomValue(ordersAtom);
  const visibleOrders = useAtomValue(filteredOrdersAtom);
  const dateFrom = useAtomValue(dateFromAtom);
  const dateTo = useAtomValue(dateToAtom);
  const hasActiveFilters = useAtomValue(hasActiveFiltersAtom);
  const hasDateRange = Boolean(dateFrom || dateTo);
  const typeSeconds = useAtomValue(typeSecondsAtom);
  const codeSeconds = useAtomValue(codeSecondsAtom);

  const theirs = useMemo(
    () => visibleOrders.filter((order) => order.employeeId === employeeId),
    [visibleOrders, employeeId],
  );
  const allTheirs = useMemo(
    () => orders.filter((order) => order.employeeId === employeeId),
    [orders, employeeId],
  );
  const stats = useMemo(
    () => summarizeOrders(theirs, { from: dateFrom, to: dateTo }),
    [theirs, dateFrom, dateTo],
  );
  const secondsByType = useMemo(
    () => sumSecondsByType(theirs, typeSeconds, codeSeconds),
    [theirs, typeSeconds, codeSeconds],
  );

  const known = Boolean(account || allTheirs.length);
  const emptyMessage =
    allTheirs.length === 0
      ? "Nhân viên này chưa có đơn hàng."
      : hasActiveFilters
        ? "Không có đơn khớp với bộ lọc."
        : "Nhân viên này chưa có đơn hàng.";

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
            ? `Mã ${employeeId}${roleLabel !== "—" ? ` · ${roleLabel}` : ""}`
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
              <MetricCard label="Đơn đã nhập" value={stats.total} />
              <MetricCard label="Mã CO" value={stats.uniqueCoCodes} />
              <MetricCard label="Mã PD" value={stats.uniquePdCodes} />
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
              <ChartCard
                className="desk:col-span-2"
                title={hasDateRange ? "Đơn theo ngày" : "Đơn 14 ngày gần đây"}
              >
                <DayBarChart items={stats.byDay} />
              </ChartCard>
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
                <ul className="m-0 list-none overflow-hidden rounded-[18px] border border-hairline bg-canvas p-0">
                  <li
                    className={`hidden border-b border-hairline px-6 py-3 text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink-muted-48 desk:grid ${typeTableCols} desk:gap-4`}
                  >
                    <span>Công đoạn</span>
                    <span>Đơn</span>
                    <span>Số giây</span>
                  </li>
                  {secondsByType.items.map((item) => (
                    <li
                      key={item.id}
                      className={`grid grid-cols-1 gap-y-2 px-6 py-[17px] ${typeTableCols} desk:items-center desk:gap-4 border-b border-hairline`}
                    >
                      <span className="text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink">
                        {item.label}
                      </span>
                      <span className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink">
                        <span className="desk:hidden">Đơn </span>
                        {item.count}
                      </span>
                      <span className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink">
                        <span className="desk:hidden">Số giây </span>
                        {formatSeconds(item.seconds)}
                      </span>
                    </li>
                  ))}
                  <li
                    className={`grid grid-cols-1 gap-y-2 px-6 py-[17px] ${typeTableCols} desk:items-center desk:gap-4`}
                  >
                    <span className="text-[17px] font-semibold leading-[1.44] tracking-[-0.374px] text-ink">
                      Tổng
                    </span>
                    <span className="text-sm font-semibold leading-[1.43] tracking-[-0.224px] text-ink tabular-nums desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px]">
                      <span className="desk:hidden">Đơn </span>
                      {secondsByType.totalCount}
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
                {theirs.length ? (
                  <span className="ml-2 font-normal text-ink-muted-48">
                    {theirs.length}
                  </span>
                ) : null}
              </h2>
              {theirs.length === 0 ? (
                <p className="m-0 text-[17px] leading-[1.44] tracking-[-0.374px] text-ink-muted-48">
                  {emptyMessage}
                </p>
              ) : (
                <ul className="m-0 list-none overflow-hidden rounded-[18px] border border-hairline bg-canvas p-0">
                  <li
                    className={`hidden border-b border-hairline px-6 py-3 text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink-muted-48 desk:grid ${orderListCols} desk:gap-4`}
                  >
                    <span>Mã</span>
                    <span>Công đoạn</span>
                    <span>Giây</span>
                    <span>Thời gian</span>
                    <span>Ghi chú</span>
                  </li>
                  {theirs.map((order, index) => (
                    <li
                      key={recordKey(order)}
                      className={`grid grid-cols-1 gap-y-2 px-6 py-[17px] ${orderListCols} desk:items-center desk:gap-4 ${
                        index < theirs.length - 1 ? "border-b border-hairline" : ""
                      }`}
                    >
                      <span className="text-[17px] font-normal tracking-[-0.374px] text-ink tabular-nums">
                        {order.code}
                      </span>
                      <span className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink">
                        {getOrderTypeLabel(order.type)}
                      </span>
                      <span className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink">
                        <span className="desk:hidden">Giây </span>
                        {formatSeconds(
                          getOrderSeconds(order, typeSeconds, codeSeconds),
                        )}
                      </span>
                      <span className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px]">
                        {formatEnteredAt(order.updatedAt || order.createdAt)}
                      </span>
                      <span className="break-words text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink">
                        {order.note || "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
