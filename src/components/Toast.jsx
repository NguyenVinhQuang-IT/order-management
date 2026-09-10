import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ToastContext = createContext(null);

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return notify;
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timeoutRef = useRef(0);

  const notify = useCallback((message, type = "success") => {
    window.clearTimeout(timeoutRef.current);
    setToast({ message, type, id: Date.now() });
    timeoutRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(timeoutRef.current);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      {toast ? (
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
      ) : null}
    </ToastContext.Provider>
  );
}
