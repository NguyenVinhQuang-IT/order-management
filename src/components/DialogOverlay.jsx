import { useRef } from "react";

const overlayClass =
  "fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 tablet:items-center tablet:p-6";

export default function DialogOverlay({ onClose, children }) {
  const downOnBackdrop = useRef(false);

  // A selection that starts inside the dialog and ends on the backdrop still
  // produces a click on this element. Only a press and release on the backdrop
  // itself should dismiss.
  function handlePointerDown(event) {
    downOnBackdrop.current = event.target === event.currentTarget;
  }

  function handlePointerUp(event) {
    const dismiss =
      downOnBackdrop.current && event.target === event.currentTarget;
    downOnBackdrop.current = false;
    if (dismiss) onClose?.();
  }

  return (
    <div
      className={overlayClass}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {children}
    </div>
  );
}
