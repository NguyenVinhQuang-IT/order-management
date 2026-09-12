import { useCallback, useEffect, useMemo, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import GlobalNav from "../components/GlobalNav";
import SecondsEditDialog from "../components/SecondsEditDialog";
import { useToast } from "../components/Toast";
import {
  getOrderTypeLabel,
  ORDER_TYPES,
  orderKey,
  ordersAtom,
  updateOrderSecondsAtom,
} from "../orders";
import {
  formatSeconds,
  getTypeSeconds,
  saveOneTypeSecondsAtom,
  typeSecondsAtom,
} from "../settings";

const primaryButtonClass =
  "h-11 cursor-pointer rounded-full border-0 bg-primary px-[22px] py-[11px] text-[17px] font-normal leading-none tracking-[-0.374px] text-white hover:bg-primary-focus focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary-focus active:scale-95 disabled:cursor-default disabled:opacity-[0.64]";

const textLinkClass =
  "cursor-pointer border-0 bg-transparent p-0 text-sm font-normal leading-[1.29] tracking-[-0.224px] text-primary";

const tableCols =
  "desk:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,0.6fr)_auto]";

export default function Settings() {
  const notify = useToast();
  const orders = useAtomValue(ordersAtom);
  const saved = useAtomValue(typeSecondsAtom);
  const saveTypeSeconds = useSetAtom(saveOneTypeSecondsAtom);
  const clearOrderSeconds = useSetAtom(updateOrderSecondsAtom);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditing(null);
  }, []);

  const rows = useMemo(() => {
    const typeRows = ORDER_TYPES.flatMap((type) => {
      const seconds = getTypeSeconds(saved, type.id);
      if (seconds == null) return [];
      return [
        {
          key: `type:${type.id}`,
          kind: "type",
          codeLabel: "Tất cả",
          type,
          seconds,
        },
      ];
    });
    const orderRows = orders
      .filter(
        (order) =>
          typeof order.seconds === "number" && Number.isFinite(order.seconds),
      )
      .map((order) => ({
        key: orderKey(order.code, order.type),
        kind: "order",
        codeLabel: order.code,
        order,
        seconds: order.seconds,
      }));
    return [...typeRows, ...orderRows];
  }, [orders, saved]);

  useEffect(() => {
    document.title = "Thiết lập số giây CO";
    return () => {
      document.title = "Order";
    };
  }, []);

  function handleRemove(row) {
    if (row.kind === "type") {
      const result = saveTypeSeconds(row.type.id, "");
      if (result.error) {
        notify(result.error, "error");
        return;
      }
      if (editing?.kind === "type" && editing.type.id === row.type.id) {
        closeDialog();
      }
      notify(`Đã xóa số giây của ${row.type.label}.`);
      return;
    }

    const result = clearOrderSeconds(row.order.code, row.order.type, null);
    if (result.error) {
      notify(result.error, "error");
      return;
    }
    if (
      editing?.kind === "order" &&
      editing.order.code === row.order.code &&
      editing.order.type === row.order.type
    ) {
      closeDialog();
    }
    notify(`Đã xóa số giây của ${row.order.code}.`);
  }

  return (
    <div className="min-h-screen bg-parchment">
      <GlobalNav />

      <main className="mx-auto max-w-[1200px] px-6 py-12 tablet:px-8 tablet:py-20">
        <div className="flex flex-col gap-6 tablet:flex-row tablet:items-end tablet:justify-between">
          <div>
            <h1 className="m-0 font-sans text-[34px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink desk:text-[40px]">
              Thiết lập số giây CO.
            </h1>
          </div>
          <button
            className={primaryButtonClass}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={dialogOpen && !editing}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Thêm mới
          </button>
        </div>

        <section className="mt-10" aria-label="Định mức số giây">
          {rows.length === 0 ? (
            <p className="m-0 text-[17px] leading-[1.44] tracking-[-0.374px] text-ink-muted-48">
              Chưa có định mức số giây.
            </p>
          ) : (
            <ul className="m-0 list-none overflow-hidden rounded-[18px] border border-hairline bg-canvas p-0">
              <li
                className={`hidden border-b border-hairline px-6 py-3 text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink-muted-48 desk:grid ${tableCols} desk:gap-4`}
              >
                <span>Mã đơn</span>
                <span>Công đoạn</span>
                <span>Số giây</span>
                <span>Thao tác</span>
              </li>
              {rows.map((row, index) => (
                <li
                  key={row.key}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-6 py-[17px] ${tableCols} ${
                    index < rows.length - 1 ? "border-b border-hairline" : ""
                  }`}
                >
                  <span className="text-[17px] font-normal tracking-[-0.374px] text-ink tabular-nums">
                    {row.codeLabel}
                  </span>
                  <span className="col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink">
                    {row.kind === "type"
                      ? row.type.label
                      : getOrderTypeLabel(row.order.type)}
                  </span>
                  <span className="col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink">
                    <span className="desk:hidden">Số giây </span>
                    {formatSeconds(row.seconds)}
                  </span>
                  <div className="col-start-2 row-start-1 flex items-center gap-4 self-center desk:col-start-auto desk:row-start-auto">
                    <button
                      className={textLinkClass}
                      type="button"
                      aria-haspopup="dialog"
                      aria-expanded={
                        Boolean(
                          editing &&
                            ((row.kind === "type" &&
                              editing.kind === "type" &&
                              editing.type.id === row.type.id) ||
                              (row.kind === "order" &&
                                editing.kind === "order" &&
                                orderKey(editing.order.code, editing.order.type) ===
                                  row.key)),
                        )
                      }
                      onClick={() => {
                        setEditing(
                          row.kind === "type"
                            ? {
                                kind: "type",
                                type: { ...row.type, seconds: row.seconds },
                              }
                            : { kind: "order", order: row.order },
                        );
                        setDialogOpen(true);
                      }}
                    >
                      Sửa
                    </button>
                    <button
                      className={textLinkClass}
                      type="button"
                      onClick={() => handleRemove(row)}
                    >
                      Xóa
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <SecondsEditDialog
        open={dialogOpen}
        entry={editing}
        onClose={closeDialog}
      />
    </div>
  );
}
