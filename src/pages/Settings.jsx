import { useCallback, useEffect, useMemo, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import GlobalNav from "../components/GlobalNav";
import SecondsEditDialog from "../components/SecondsEditDialog";
import { useToast } from "../components/Toast";
import {
  getOrderTypeLabel,
  orderKey,
  ordersAtom,
  updateOrderSecondsAtom,
} from "../orders";
import { formatSeconds } from "../settings";

const primaryButtonClass =
  "h-11 cursor-pointer rounded-full border-0 bg-primary px-[22px] py-[11px] text-[17px] font-normal leading-none tracking-[-0.374px] text-white hover:bg-primary-focus focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary-focus active:scale-95 disabled:cursor-default disabled:opacity-[0.64]";

const textLinkClass =
  "cursor-pointer border-0 bg-transparent p-0 text-sm font-normal leading-[1.29] tracking-[-0.224px] text-primary";

const tableCols =
  "desk:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,0.6fr)_auto]";

function hasOrderSeconds(order) {
  return typeof order?.seconds === "number" && Number.isFinite(order.seconds);
}

export default function Settings() {
  const notify = useToast();
  const orders = useAtomValue(ordersAtom);
  const clearSeconds = useSetAtom(updateOrderSecondsAtom);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingOrder(null);
  }, []);

  const configured = useMemo(
    () => orders.filter(hasOrderSeconds),
    [orders],
  );

  useEffect(() => {
    document.title = "Thiết lập số giây CO";
    return () => {
      document.title = "Order";
    };
  }, []);

  function handleRemove(order) {
    const result = clearSeconds(order.code, order.type, null);
    if (result.error) {
      notify(result.error, "error");
      return;
    }
    if (
      editingOrder &&
      editingOrder.code === order.code &&
      editingOrder.type === order.type
    ) {
      closeDialog();
    }
    notify(`Đã xóa số giây của ${order.code}.`);
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
            <p className="mt-4 max-w-[34ch] font-sans text-[21px] font-normal leading-[1.19] tracking-[0.196px] text-ink-muted-80 desk:text-[28px] desk:leading-[1.14]">
              Tìm mã CO đã nhập và gán số giây cho đơn đó.
            </p>
          </div>
          <button
            className={primaryButtonClass}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={dialogOpen && !editingOrder}
            onClick={() => {
              setEditingOrder(null);
              setDialogOpen(true);
            }}
          >
            Thêm mới
          </button>
        </div>

        <section className="mt-10" aria-label="Định mức số giây">
          {configured.length === 0 ? (
            <p className="m-0 text-[17px] leading-[1.44] tracking-[-0.374px] text-ink-muted-48">
              {orders.length === 0
                ? "Chưa có đơn hàng. Nhập CO trước khi thiết lập số giây."
                : "Chưa có định mức số giây."}
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
              {configured.map((order, index) => {
                const key = orderKey(order.code, order.type);
                return (
                  <li
                    key={key}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-6 py-[17px] ${tableCols} ${
                      index < configured.length - 1 ? "border-b border-hairline" : ""
                    }`}
                  >
                    <span className="text-[17px] font-normal tracking-[-0.374px] text-ink tabular-nums">
                      {order.code}
                    </span>
                    <span className="col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink">
                      {getOrderTypeLabel(order.type)}
                    </span>
                    <span className="col-start-1 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-80 tabular-nums desk:col-start-auto desk:text-[17px] desk:leading-[1.44] desk:tracking-[-0.374px] desk:text-ink">
                      <span className="desk:hidden">Số giây </span>
                      {formatSeconds(order.seconds)}
                    </span>
                    <div className="col-start-2 row-start-1 flex items-center gap-4 self-center desk:col-start-auto desk:row-start-auto">
                      <button
                        className={textLinkClass}
                        type="button"
                        aria-haspopup="dialog"
                        aria-expanded={
                          Boolean(
                            editingOrder &&
                              orderKey(editingOrder.code, editingOrder.type) ===
                                key,
                          )
                        }
                        onClick={() => {
                          setDialogOpen(false);
                          setEditingOrder(order);
                        }}
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
        </section>
      </main>

      <SecondsEditDialog
        open={dialogOpen || Boolean(editingOrder)}
        order={editingOrder}
        onClose={closeDialog}
      />
    </div>
  );
}
