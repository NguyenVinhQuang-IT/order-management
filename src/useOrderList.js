import { useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  dateFromAtom,
  dateToAtom,
  hasActiveFiltersAtom,
  loadOrdersAtom,
  orderKindFilterAtom,
  orderPageAtom,
  orderTypeFilterAtom,
  searchQueryAtom,
} from "./orders";

// Survives dashboard unmount so returning with the same filters keeps the page.
let lastListKey = null;
const ORDER_REFRESH_MS = 10 * 60 * 1000;

export function useDebouncedFilters() {
  const searchQuery = useAtomValue(searchQueryAtom);
  const type = useAtomValue(orderTypeFilterAtom);
  const kind = useAtomValue(orderKindFilterAtom);
  const from = useAtomValue(dateFromAtom);
  const to = useAtomValue(dateToAtom);
  const hasActiveFilters = useAtomValue(hasActiveFiltersAtom);
  const [query, setQuery] = useState(searchQuery);

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(searchQuery), 250);
    return () => window.clearTimeout(id);
  }, [searchQuery]);

  return { query, type, kind, from, to, hasActiveFilters, searchQuery };
}

export function useOrderListLoader() {
  const filters = useDebouncedFilters();
  const page = useAtomValue(orderPageAtom);
  const setPage = useSetAtom(orderPageAtom);
  const loadOrders = useSetAtom(loadOrdersAtom);
  const key = [filters.query, filters.type, filters.kind, filters.from, filters.to].join("\0");

  useEffect(() => {
    const changed = lastListKey !== null && lastListKey !== key;
    lastListKey = key;
    if (changed && page !== 0) {
      setPage(0);
      return;
    }
    loadOrders({
      q: filters.query,
      type: filters.type,
      kind: filters.kind,
      from: filters.from,
      to: filters.to,
      page: changed ? 0 : page,
    }).catch(() => {});
  }, [
    key,
    page,
    loadOrders,
    setPage,
    filters.query,
    filters.type,
    filters.kind,
    filters.from,
    filters.to,
  ]);

  useEffect(() => {
    const id = window.setInterval(() => {
      loadOrders({
        q: filters.query,
        type: filters.type,
        kind: filters.kind,
        from: filters.from,
        to: filters.to,
        page,
      }).catch(() => {});
    }, ORDER_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [
    loadOrders,
    page,
    filters.query,
    filters.type,
    filters.kind,
    filters.from,
    filters.to,
  ]);

  return filters;
}
