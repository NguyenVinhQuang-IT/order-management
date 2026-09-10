import { createJSONStorage } from "jotai/utils";

export const sessionJsonStorage = createJSONStorage(() =>
  typeof window !== "undefined" ? window.sessionStorage : undefined,
);
