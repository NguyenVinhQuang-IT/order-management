import { atom } from "jotai";
import { api, mapEmployee } from "./api";
import { employeesAtom, signOutAtom } from "./auth";
import {
  loadOrdersAtom,
  orderPageAtom,
  ordersAtom,
  ordersTotalAtom,
  pickerOrdersAtom,
  unmatchedSearchAtom,
} from "./orders";
import { codeSecondsSettingsAtom, secondsSettingsAtom } from "./settings";

export const loadWorkspaceAtom = atom(null, async (_get, set) => {
  const [, employees, settings] = await Promise.all([
    set(loadOrdersAtom, { page: 0 }),
    api("/employees"),
    api("/settings"),
  ]);
  set(employeesAtom, (employees.items || []).map(mapEmployee));
  set(secondsSettingsAtom, settings.type_seconds || {});
  set(codeSecondsSettingsAtom, settings.code_seconds || {});
});

export const resetWorkspaceAtom = atom(null, (_get, set) => {
  set(signOutAtom);
  set(ordersAtom, []);
  set(ordersTotalAtom, 0);
  set(orderPageAtom, 0);
  set(unmatchedSearchAtom, []);
  set(pickerOrdersAtom, []);
  set(employeesAtom, []);
  set(secondsSettingsAtom, {});
  set(codeSecondsSettingsAtom, {});
});
