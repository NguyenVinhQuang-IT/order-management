import { createContext, useContext } from "react";

const SecondsEditFormContext = createContext(null);

export function SecondsEditFormProvider({ value, children }) {
  return (
    <SecondsEditFormContext.Provider value={value}>
      {children}
    </SecondsEditFormContext.Provider>
  );
}

export function useSecondsEditForm() {
  const value = useContext(SecondsEditFormContext);
  if (!value) {
    throw new Error("useSecondsEditForm must be used inside SecondsEditDialog.");
  }
  return value;
}

export function useSecondsSubmit(handler) {
  const { submitRef } = useSecondsEditForm();
  submitRef.current = handler;
}
