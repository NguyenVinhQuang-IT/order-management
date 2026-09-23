import { atom } from "jotai";
import { api, mapEmployee, mapOrder } from "./api";
import { employeesAtom, signOutAtom } from "./auth";
import { ordersAtom } from "./orders";
import { codeSecondsSettingsAtom, secondsSettingsAtom } from "./settings";

export const loadWorkspaceAtom = atom(null, async (_get, set) => {
  const [orders, employees, settings] = await Promise.all([
    api("/orders"),
    api("/employees"),
    api("/settings"),
  ]);
  set(ordersAtom, (orders.items || []).map(mapOrder));
  set(employeesAtom, (employees.items || []).map(mapEmployee));
  set(secondsSettingsAtom, settings.type_seconds || {});
  set(codeSecondsSettingsAtom, settings.code_seconds || {});
});

export const resetWorkspaceAtom = atom(null, (_get, set) => {
  set(signOutAtom);
  set(ordersAtom, []);
  set(employeesAtom, []);
  set(secondsSettingsAtom, {});
  set(codeSecondsSettingsAtom, {});
});
