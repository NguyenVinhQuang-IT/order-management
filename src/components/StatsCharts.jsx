import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { employeePath } from "../auth";
import { formatCount } from "../settings";
import DialogOverlay from "./DialogOverlay";
import { ghostButtonClass } from "./order-entry/styles";

const textButtonClass =
  "cursor-pointer border-0 bg-transparent p-0 text-sm font-normal leading-[1.29] tracking-[-0.224px] text-primary";

const TYPE_COLORS = {
  "xep-ban-nhan-don": "#2563EB",
  "kiem-don-voi-mau": "#EA580C",
  "phan-hinh-the-mau-tem-chuyen-in": "#16A34A",
  "luu-thong-so-san-pham": "#C026D3",
  "sap-xep-seka": "#CA8A04",
  "lam-don": "#0891B2",
  "kiem-don": "#7C3AED",
  "gui-layout-don-san-xuat": "#E11D48",
  "lam-file-ban-nhua": "#0D9488",
  "lam-layout": "#D97706",
  "lam-don-mau": "#4F46E5",
  "bu-don": "#65A30D",
  "ve-cat-hinh-giay": "#DB2777",
  "luu-macro": "#0369A1",
  "upload-hinh-giay": "#B45309",
  "viet-code": "#059669",
  "luu-size-doi-chieu": "#9333EA",
  "luu-btw": "#F59E0B",
  "don-loi": "#DC2626",
};

function niceMax(value) {
  if (value <= 0) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function colorForType(typeId) {
  return TYPE_COLORS[typeId] || "#6B7280";
}

const CHANGE_UP = "#16A34A";
const CHANGE_DOWN = "#DC2626";
const CHANGE_FLAT = "#86868B";

function changeColor(delta) {
  if (delta > 0) return CHANGE_UP;
  if (delta < 0) return CHANGE_DOWN;
  return CHANGE_FLAT;
}

function formatSignedCount(delta) {
  if (delta > 0) return `+${formatCount(delta)}`;
  if (delta < 0) return `−${formatCount(-delta)}`;
  return "0";
}

function formatChangePercent(delta, prev) {
  if (prev == null) return "";
  if (prev <= 0) return delta > 0 ? "mới" : "";
  const pct = Math.abs((delta / prev) * 100);
  const rounded = pct >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10;
  const text = Number(rounded).toLocaleString("vi-VN");
  if (delta > 0) return `+${text}%`;
  if (delta < 0) return `−${text}%`;
  return "0%";
}

function typesWithCounts(items) {
  const source = items[0]?.byType?.length ? items[0].byType : [];
  return source.filter((type) =>
    items.some(
      (item) =>
        (item.byType?.find((entry) => entry.id === type.id)?.count ?? 0) > 0,
    ),
  );
}

const DONUT_MIN_ARC = 6;
const BAR_MIN_SEGMENT = 3;

function allocateMinSizes(values, total, minSize) {
  const result = values.map(() => 0);
  const positive = values
    .map((value, index) => ({ index, value: Number(value) || 0 }))
    .filter((item) => item.value > 0);
  if (!positive.length || total <= 0) return result;

  const min = Math.min(minSize, total / Math.max(positive.length * 2, 1));
  let remaining = total;
  let unlocked = positive;
  for (let step = 0; step < positive.length; step += 1) {
    const sum = unlocked.reduce((acc, item) => acc + item.value, 0);
    const next = [];
    let lockedAny = false;
    for (const item of unlocked) {
      const share = sum > 0 ? (item.value / sum) * remaining : 0;
      if (share < min) {
        result[item.index] = min;
        remaining -= min;
        lockedAny = true;
      } else {
        next.push(item);
      }
    }
    unlocked = next;
    if (!lockedAny) break;
    if (remaining <= 0) break;
  }
  const sum = unlocked.reduce((acc, item) => acc + item.value, 0);
  for (const item of unlocked) {
    result[item.index] = sum > 0 ? (item.value / sum) * remaining : 0;
  }
  return result;
}

export function ChartCard({ title, children, className = "", action = null }) {
  return (
    <article
      className={`rounded-[18px] border border-hairline bg-canvas p-6 ${className}`}
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="m-0 text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </article>
  );
}

export function DonutChart({ items, total }) {
  const size = 140;
  const cx = 70;
  const cy = 70;
  const radius = 48;
  const stroke = 14;
  const circumference = 2 * Math.PI * radius;

  const visible = items.filter((item) => item.count > 0);
  const lengths =
    total > 0
      ? allocateMinSizes(
          visible.map((item) => item.count),
          circumference,
          DONUT_MIN_ARC,
        )
      : [];
  const arcs = [];
  let offset = 0;
  visible.forEach((item, index) => {
    const length = lengths[index] || 0;
    if (length <= 0) return;
    arcs.push({ id: item.id, length, offset, color: colorForType(item.id) });
    offset += length;
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Tỷ lệ đơn theo công đoạn"
      >
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#f5f5f7"
          strokeWidth={stroke}
        />
        {arcs.map((arc) => (
          <circle
            key={arc.id}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeDasharray={`${arc.length} ${circumference - arc.length}`}
            strokeDashoffset={-arc.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fill="#1d1d1f"
          fontSize={formatCount(total).length > 5 ? 16 : 22}
          fontWeight="600"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {formatCount(total)}
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          fill="#7a7a7a"
          fontSize="11"
          fontFamily="Inter, system-ui, sans-serif"
        >
          đơn
        </text>
      </svg>
      <ul className="m-0 flex w-full list-none flex-col gap-2 p-0">
        {visible.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm leading-[1.29] tracking-[-0.224px] text-ink">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: colorForType(item.id) }}
                aria-hidden="true"
              />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="text-sm leading-[1.29] tracking-[-0.224px] text-ink tabular-nums">
              {formatCount(item.count)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DayBarChart({ items, size = "default" }) {
  const [tip, setTip] = useState(null);
  const expanded = size === "expanded";
  const visibleTypes = typesWithCounts(items);
  const height = expanded ? 540 : 320;
  const width = Math.max(
    expanded ? 960 : 640,
    items.length * (expanded ? 56 : 44) + 72,
  );
  const padL = 56;
  const padR = 12;
  const padT = 46;
  const padB = 36;
  const clipPrefix = expanded ? "day-lg" : "day";
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const max = niceMax(Math.max(...items.map((item) => item.count), 0));
  const groupGap = 8;
  const groupW = Math.max(
    16,
    (plotW - groupGap * (items.length + 1)) / Math.max(items.length, 1),
  );
  const barW = Math.max(12, groupW * 0.62);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const dayPoints = items.map((item, index) => {
    const groupX = padL + groupGap + index * (groupW + groupGap);
    const x = groupX + groupW / 2;
    const rawHeight = max > 0 ? (item.count / max) * plotH : 0;
    const totalHeight = item.count > 0 ? Math.max(rawHeight, 4) : 0;
    const y = padT + plotH - totalHeight;
    const lineY = padT + plotH - rawHeight;
    const prev = index > 0 ? items[index - 1].count : null;
    const delta = prev == null ? null : item.count - prev;
    return {
      item,
      index,
      groupX,
      x,
      y,
      lineY,
      rawHeight,
      totalHeight,
      prev,
      delta,
    };
  });
  const linePoints = dayPoints
    .map((point) => `${point.x},${point.lineY}`)
    .join(" ");

  function showTip(event, point, typeLabel, count) {
    setTip({
      x: event.clientX,
      y: event.clientY,
      dayLabel: point.item.label,
      typeLabel,
      count,
      dayTotal: point.item.count,
      delta: point.delta,
      prev: point.prev,
    });
  }

  return (
    <div>
      <div
        className={`relative overflow-x-auto ${expanded ? "h-[540px]" : "h-[320px]"}`}
        onMouseLeave={() => setTip(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block h-full max-w-none"
          style={{ width: "100%", minWidth: `${width}px` }}
          role="img"
          aria-label="Số đơn theo ngày và công đoạn"
        >
          <defs>
            {dayPoints.map((point) => {
              if (point.totalHeight <= 0) return null;
              const barX = point.groupX + (groupW - barW) / 2;
              return (
                <clipPath
                  key={point.item.id}
                  id={`${clipPrefix}-stack-${point.item.id}`}
                >
                  <rect
                    x={barX}
                    y={point.y}
                    width={barW}
                    height={point.totalHeight}
                    rx={6}
                  />
                </clipPath>
              );
            })}
          </defs>
          {ticks.map((tick) => {
            const y = padT + plotH * (1 - tick);
            return (
              <g key={tick}>
                <line
                  x1={padL}
                  x2={width - padR}
                  y1={y}
                  y2={y}
                  stroke="#e0e0e0"
                />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#7a7a7a"
                  fontSize="11"
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {formatCount(Math.round(max * tick))}
                </text>
              </g>
            );
          })}
          {dayPoints.map((point) => {
            const { item, groupX, totalHeight } = point;
            const barX = groupX + (groupW - barW) / 2;
            const series = visibleTypes
              .map((type) => ({
                ...type,
                count:
                  item.byType?.find((entry) => entry.id === type.id)?.count ??
                  (type.id === "all" ? item.count : 0),
              }))
              .filter((type) => type.count > 0);
            const heights = allocateMinSizes(
              series.map((type) => type.count),
              totalHeight,
              BAR_MIN_SEGMENT,
            );
            let yCursor = padT + plotH;
            const segments = series.map((type, index) => {
              const segmentHeight = heights[index] || 0;
              yCursor -= segmentHeight;
              return { ...type, y: yCursor, height: segmentHeight };
            });
            return (
              <g key={item.id}>
                <g clipPath={`url(#${clipPrefix}-stack-${item.id})`}>
                  {segments.map((type) => (
                    <rect
                      key={type.id}
                      x={barX}
                      y={type.y}
                      width={barW}
                      height={type.height}
                      fill={colorForType(type.id)}
                      className="cursor-pointer"
                      onMouseEnter={(event) =>
                        showTip(event, point, type.label || "Đơn", type.count)
                      }
                      onMouseMove={(event) =>
                        showTip(event, point, type.label || "Đơn", type.count)
                      }
                    />
                  ))}
                </g>
                <text
                  x={groupX + groupW / 2}
                  y={height - 12}
                  textAnchor="middle"
                  fill="#7a7a7a"
                  fontSize="11"
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {item.label}
                </text>
              </g>
            );
          })}
          {dayPoints.length > 1 ? (
            <polyline
              fill="none"
              stroke="#1d1d1f"
              strokeWidth={expanded ? 2 : 1.6}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={linePoints}
            />
          ) : null}
          {dayPoints.map((point) => (
            <circle
              key={`dot-${point.item.id}`}
              cx={point.x}
              cy={point.lineY}
              r={expanded ? 4 : 3}
              fill="#ffffff"
              stroke={
                point.delta == null ? "#1d1d1f" : changeColor(point.delta)
              }
              strokeWidth={1.5}
              className="cursor-pointer"
              onMouseEnter={(event) =>
                showTip(event, point, "Tổng ngày", point.item.count)
              }
              onMouseMove={(event) =>
                showTip(event, point, "Tổng ngày", point.item.count)
              }
            />
          ))}
          {dayPoints.map((point) => {
            if (point.item.count <= 0) return null;
            const color =
              point.delta == null ? "#1d1d1f" : changeColor(point.delta);
            const mark =
              point.delta == null
                ? ""
                : point.delta > 0
                  ? "▲"
                  : point.delta < 0
                    ? "▼"
                    : "●";
            return (
              <g key={`label-${point.item.id}`}>
                {point.delta != null ? (
                  <text
                    x={point.x}
                    y={point.y - 18}
                    textAnchor="middle"
                    fill={color}
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    {mark} {formatSignedCount(point.delta)}
                  </text>
                ) : null}
                <text
                  x={point.x}
                  y={point.y - 6}
                  textAnchor="middle"
                  fill="#1d1d1f"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {formatCount(point.item.count)}
                </text>
              </g>
            );
          })}
        </svg>
        {tip ? (
          <div
            className="pointer-events-none fixed z-[60] rounded-[12px] bg-ink px-3 py-2 text-white shadow-product"
            style={{ left: tip.x + 12, top: tip.y - 12, transform: "translateY(-100%)" }}
          >
            <p className="m-0 text-sm font-normal leading-[1.29] tracking-[-0.224px] text-body-muted">
              {tip.dayLabel} · {tip.typeLabel}
            </p>
            <p className="m-0 mt-1 text-[17px] font-semibold leading-none tracking-[-0.374px] tabular-nums">
              {formatCount(tip.count)} đơn
              {tip.dayTotal > tip.count
                ? ` · ${formatCount(tip.dayTotal)} cả ngày`
                : ""}
            </p>
            {tip.delta != null ? (
              <p
                className="m-0 mt-2 text-sm font-semibold leading-[1.29] tracking-[-0.224px] tabular-nums"
                style={{ color: changeColor(tip.delta) }}
              >
                {tip.delta > 0 ? "▲ Tăng " : tip.delta < 0 ? "▼ Giảm " : "● "}
                {formatCount(Math.abs(tip.delta))}
                {formatChangePercent(tip.delta, tip.prev)
                  ? ` (${formatChangePercent(tip.delta, tip.prev)})`
                  : ""}
                {" so với ngày trước"}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {visibleTypes.length ? (
        <ul className="mt-4 m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0">
          {visibleTypes.map((type) => (
            <li
              key={type.id}
              className="flex items-center gap-2 text-sm leading-[1.29] tracking-[-0.224px] text-ink"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{
                  backgroundColor: colorForType(type.id),
                }}
                aria-hidden="true"
              />
              {type.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ExpandableDayChart({ title, items, className = "" }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <>
      <ChartCard
        className={className}
        title={title}
        action={
          <button
            className={textButtonClass}
            type="button"
            onClick={() => setOpen(true)}
          >
            Phóng to
          </button>
        }
      >
        <DayBarChart items={items} />
      </ChartCard>
      {open ? (
        <DialogOverlay onClose={() => setOpen(false)}>
          <div
            className="max-h-[94vh] w-full overflow-y-auto rounded-t-[18px] border border-hairline bg-canvas p-6 shadow-product tablet:max-w-[1200px] tablet:rounded-[18px] tablet:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="day-chart-expand-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <h2
                id="day-chart-expand-title"
                className="m-0 font-sans text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-ink"
              >
                {title}
              </h2>
              <button
                className={ghostButtonClass}
                type="button"
                onClick={() => setOpen(false)}
              >
                Đóng
              </button>
            </div>
            <DayBarChart items={items} size="expanded" />
          </div>
        </DialogOverlay>
      ) : null}
    </>
  );
}

function EmployeeStageBars({ item, max }) {
  const series = (item.byType?.length ? item.byType : [{ id: "all", count: item.count }])
    .filter((type) => type.count > 0);
  const name = item.name && item.name !== "—" ? item.name : item.employeeId;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <span>
        <span className="block text-sm leading-[1.43] tracking-[-0.224px] text-ink">
          {name}
        </span>
        <span className="block text-sm leading-[1.29] tracking-[-0.224px] text-ink-muted-48 tabular-nums">
          {item.employeeId}
        </span>
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        {(series.length ? series : [{ id: "empty", label: "Đơn", count: 0 }]).map(
          (type) => {
            const percent = max > 0 ? (type.count / max) * 100 : 0;
            return (
              <div
                key={type.id}
                className="grid grid-cols-1 gap-1 tablet:grid-cols-[minmax(12rem,20rem)_minmax(0,1fr)_3.5rem] tablet:items-center tablet:gap-3"
              >
                <span className="flex min-w-0 items-start gap-2 text-sm leading-[1.29] tracking-[-0.224px] text-ink">
                  <span
                    className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: colorForType(type.id) }}
                    aria-hidden="true"
                  />
                  <span>{type.label || "Đơn"}</span>
                </span>
                <div className="h-2.5 min-w-0 rounded-full bg-parchment">
                  {type.count > 0 ? (
                    <div
                      className="h-2.5 rounded-full"
                      style={{
                        width: `${percent}%`,
                        minWidth: 8,
                        backgroundColor: colorForType(type.id),
                      }}
                    />
                  ) : null}
                </div>
                <span className="text-sm leading-[1.29] tracking-[-0.224px] text-ink tabular-nums tablet:text-right">
                  {formatCount(type.count)}
                </span>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}

export function EmployeeBarChart({ items, empty = "Chưa có dữ liệu." }) {
  const max = Math.max(
    ...items.flatMap((item) =>
      item.byType?.length
        ? item.byType.map((type) => type.count)
        : [item.count],
    ),
    0,
  );

  if (items.length === 0) {
    return (
      <p className="m-0 text-[17px] leading-[1.44] tracking-[-0.374px] text-ink-muted-48">
        {empty}
      </p>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-6 p-0">
      {items.map((item) => (
        <li key={item.employeeId}>
          {item.employeeId && item.employeeId !== "—" ? (
            <Link
              to={employeePath(item.employeeId)}
              className="block no-underline hover:opacity-80"
            >
              <EmployeeStageBars item={item} max={max} />
            </Link>
          ) : (
            <EmployeeStageBars item={item} max={max} />
          )}
        </li>
      ))}
    </ul>
  );
}
