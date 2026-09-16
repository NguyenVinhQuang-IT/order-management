import { createContext, useContext } from "react";

const OrderEntryFormContext = createContext(null);

export function OrderEntryFormProvider({ value, children }) {
  return (
    <OrderEntryFormContext.Provider value={value}>
      {children}
    </OrderEntryFormContext.Provider>
  );
}

export function useOrderEntryForm() {
  const value = useContext(OrderEntryFormContext);
  if (!value) {
    throw new Error("useOrderEntryForm must be used inside OrderEntryDialog.");
  }
  return value;
}

export function useOrderEntrySubmit(handler) {
  const { submitRef } = useOrderEntryForm();
  submitRef.current = handler;
}
