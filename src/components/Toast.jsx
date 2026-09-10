import { useEffect } from "react";
import { atom, useAtom, useSetAtom } from "jotai";

const toastAtom = atom(null);

const notifyAtom = atom(null, (_get, set, message, type = "success") => {
  set(toastAtom, { message, type, id: Date.now() });
});

export function useToast() {
  return useSetAtom(notifyAtom);
}

export default function Toast() {
  const [toast, setToast] = useAtom(toastAtom);

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [toast, setToast]);

  if (!toast) return null;

  return (
    <div
      key={toast.id}
      className={`fixed top-[60px] left-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 rounded-[18px] px-5 py-4 text-center text-[17px] font-semibold leading-[1.24] tracking-[-0.374px] text-white shadow-[3px_5px_30px_rgba(0,0,0,0.22)] ${
        toast.type === "error" ? "bg-[#bf4800]" : "bg-ink"
      }`}
      role="status"
      onClick={() => setToast(null)}
    >
      {toast.message}
    </div>
  );
}
