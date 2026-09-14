import { useState } from "react";
import { Link } from "react-router-dom";
import { employeePath } from "../auth";

const CHART_COLORS = [
  "#0066cc",
  "#1d1d1f",
  "#6e6e73",
  "#2997ff",
  "#bf4800",
  "#0071e3",
  "#515154",
  "#64d2ff",
  "#8e8e93",
  "#147ce5",
  "#424245",
  "#5ac8fa",
  "#86868b",
  "#0a84ff",
  "#636366",
  "#7dc1ff",
  "#aeaeb2",
  "#409cff",
  "#3a3a3c",
];

function niceMax(value) {
  if (value <= 0) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function typeColor(index) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

function colorForType(typeId, types) {
  const index = types.findIndex((type) => type.id === typeId);
  return typeColor(index < 0 ? 0 : index);
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

export function ChartCard({ title, children, className = "" }) {
  return (
    <article
      className={`rounded-[18px] border border-hairline bg-canvas p-6 ${className}`}
    >
      <h2 className="mb-6 text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
        {title}
      </h2>
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
  const arcs = [];
  let offset = 0;
  items.forEach((item, index) => {
    if (total > 0 && item.count > 0) {
      const length = (item.count / total) * circumference;
      arcs.push({ id: item.id, length, offset, color: typeColor(index) });
      offset += length;
    }
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
          fontSize="22"
          fontWeight="600"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {total}
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
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: colorForType(item.id, items) }}
                aria-hidden="true"
              />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="text-sm leading-[1.29] tracking-[-0.224px] text-ink tabular-nums">
              {item.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DayBarChart({ items }) {
  const [tip, setTip] = useState(null);
  const allTypes = items[0]?.byType?.length
    ? items[0].byType
    : [{ id: "all", label: "Đơn", count: 0 }];
  const types = typesWithCounts(items);
  const visibleTypes = types.length ? types : allTypes;
  const typeCount = Math.max(visibleTypes.length, 1);
  const width = Math.max(420, items.length * (18 * typeCount + 16) + 40);
  const height = 220;
  const padL = 28;
  const padR = 8;
  const padT = 12;
  const padB = 32;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const max = niceMax(
    Math.max(
      ...items.flatMap((item) =>
        item.byType?.length
          ? item.byType.map((type) => type.count)
          : [item.count],
      ),
      0,
    ),
  );
  const groupGap = 10;
  const barGap = 3;
  const groupW = Math.max(
    12,
    (plotW - groupGap * (items.length + 1)) / items.length,
  );
  const barW = Math.max(6, (groupW - barGap * (typeCount - 1)) / typeCount);
  const ticks = [0, 0.5, 1];

  function showTip(event, dayLabel, typeLabel, count) {
    setTip({
      x: event.clientX,
      y: event.clientY,
      dayLabel,
      typeLabel,
      count,
    });
  }

  return (
    <div>
      <div className="relative overflow-x-auto" onMouseLeave={() => setTip(null)}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label="Số đơn theo ngày và công đoạn"
        >
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
                  x={padL - 6}
                  y={y + 4}
                  textAnchor="end"
                  fill="#7a7a7a"
                  fontSize="11"
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {Math.round(max * tick)}
                </text>
              </g>
            );
          })}
          {items.map((item, index) => {
            const groupX = padL + groupGap + index * (groupW + groupGap);
            const series = visibleTypes.map((type) => ({
              ...type,
              count:
                item.byType?.find((entry) => entry.id === type.id)?.count ??
                (type.id === "all" ? item.count : 0),
            }));
            const barsWidth = typeCount * barW + (typeCount - 1) * barGap;
            const barOrigin = groupX + Math.max(0, (groupW - barsWidth) / 2);
            return (
              <g key={item.id}>
                {series.map((type, typeIndex) => {
                  const heightValue = max > 0 ? (type.count / max) * plotH : 0;
                  const x = barOrigin + typeIndex * (barW + barGap);
                  const y = padT + plotH - heightValue;
                  if (type.count <= 0) return null;
                  const typeLabel =
                    type.label || visibleTypes[typeIndex]?.label || "Đơn";
                  return (
                    <rect
                      key={type.id}
                      x={x}
                      y={y}
                      width={barW}
                      height={heightValue}
                      rx={5}
                      fill={colorForType(type.id, allTypes)}
                      className="cursor-pointer"
                      onMouseEnter={(event) =>
                        showTip(event, item.label, typeLabel, type.count)
                      }
                      onMouseMove={(event) =>
                        showTip(event, item.label, typeLabel, type.count)
                      }
                    />
                  );
                })}
                <text
                  x={groupX + groupW / 2}
                  y={height - 10}
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
        </svg>
        {tip ? (
          <div
            className="pointer-events-none fixed z-50 rounded-[12px] bg-ink px-3 py-2 text-white shadow-product"
            style={{ left: tip.x + 12, top: tip.y - 12, transform: "translateY(-100%)" }}
          >
            <p className="m-0 text-sm font-normal leading-[1.29] tracking-[-0.224px] text-body-muted">
              {tip.dayLabel} · {tip.typeLabel}
            </p>
            <p className="m-0 mt-1 text-[17px] font-semibold leading-none tracking-[-0.374px] tabular-nums">
              {tip.count} đơn
            </p>
          </div>
        ) : null}
      </div>
      <ul className="mt-4 m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0">
        {visibleTypes.map((type) => (
          <li
            key={type.id}
            className="flex items-center gap-2 text-sm leading-[1.29] tracking-[-0.224px] text-ink"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                backgroundColor: colorForType(type.id, allTypes),
              }}
              aria-hidden="true"
            />
            {type.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmployeeStageBars({ item, max, types }) {
  const series = (item.byType?.length ? item.byType : [{ id: "all", count: item.count }])
    .filter((type) => type.count > 0);

  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="w-[7.5rem] shrink-0">
        <span className="block truncate text-sm leading-[1.29] tracking-[-0.224px] text-ink">
          {item.name && item.name !== "—" ? item.name : item.employeeId}
        </span>
        <span className="block text-sm leading-[1.29] tracking-[-0.224px] text-ink-muted-48 tabular-nums">
          {item.employeeId}
        </span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {(series.length ? series : [{ id: "empty", count: 0 }]).map((type) => {
          const percent = max > 0 ? (type.count / max) * 100 : 0;
          return (
            <div key={type.id} className="flex items-center gap-3">
              <div className="h-2.5 min-w-0 flex-1 rounded-full bg-parchment">
                {type.count > 0 ? (
                  <div
                    className="h-2.5 rounded-full"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: colorForType(type.id, types),
                    }}
                  />
                ) : null}
              </div>
              <span className="w-10 shrink-0 text-right text-sm leading-[1.29] tracking-[-0.224px] text-ink tabular-nums">
                {type.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EmployeeBarChart({ items, empty = "Chưa có dữ liệu." }) {
  const allTypes = items[0]?.byType?.length ? items[0].byType : [];
  const types = typesWithCounts(items);
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
    <div>
      <ul className="m-0 flex list-none flex-col gap-5 p-0">
        {items.map((item) => (
          <li key={item.employeeId}>
            {item.employeeId && item.employeeId !== "—" ? (
              <Link
                to={employeePath(item.employeeId)}
                className="block no-underline hover:opacity-80"
              >
                <EmployeeStageBars item={item} max={max} types={allTypes} />
              </Link>
            ) : (
              <EmployeeStageBars item={item} max={max} types={allTypes} />
            )}
          </li>
        ))}
      </ul>
      {types.length ? (
        <ul className="mt-4 m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0">
          {types.map((type) => (
            <li
              key={type.id}
              className="flex items-center gap-2 text-sm leading-[1.29] tracking-[-0.224px] text-ink"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: colorForType(type.id, allTypes),
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
