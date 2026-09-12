import { useCallback, useEffect, useState } from "react";
import GlobalNav from "../components/GlobalNav";
import SecondsEditDialog from "../components/SecondsEditDialog";

const primaryButtonClass =
  "h-11 cursor-pointer rounded-full border-0 bg-primary px-[22px] py-[11px] text-[17px] font-normal leading-none tracking-[-0.374px] text-white hover:bg-primary-focus focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary-focus active:scale-95 disabled:cursor-default disabled:opacity-[0.64]";

export default function Settings() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const closeDialog = useCallback(() => setDialogOpen(false), []);

  useEffect(() => {
    document.title = "Thiết lập số giây CO";
    return () => {
      document.title = "Order";
    };
  }, []);

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
            aria-expanded={dialogOpen}
            onClick={() => setDialogOpen(true)}
          >
            Thiết lập số giây
          </button>
        </div>
      </main>

      <SecondsEditDialog open={dialogOpen} onClose={closeDialog} />
    </div>
  );
}
