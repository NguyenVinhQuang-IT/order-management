import { useAtomValue, useSetAtom } from "jotai";
import { ApplyScope, PdCodesField, SecondsField } from "../fields";
import { useSecondsEditForm, useSecondsSubmit } from "../context";
import { PD_SCOPE, SCOPES } from "../styles";
import { sessionAtom } from "../../../auth";
import {
  addOrdersAtom,
  getOrderKind,
  MAX_ORDERS_PER_ENTRY,
  recordKey,
  updateOrderSecondsAtom,
  updateOrdersSecondsAtom,
} from "../../../orders";
import {
  parseSecondsInput,
  saveCodeSecondsAtom,
  saveOneCodeSecondsAtom,
  saveOneTypeSecondsAtom,
} from "../../../settings";

export default function KiemDonFields() {
  const {
    isEdit,
    entry,
    orderType,
    typeLabel,
    scope,
    typeOrders,
    value,
    pdPreview,
    setFormError,
    notify,
    onClose,
  } = useSecondsEditForm();
  const session = useAtomValue(sessionAtom);
  const addOrders = useSetAtom(addOrdersAtom);
  const saveTypeSeconds = useSetAtom(saveOneTypeSecondsAtom);
  const saveOrderSeconds = useSetAtom(updateOrderSecondsAtom);
  const saveOrdersSeconds = useSetAtom(updateOrdersSecondsAtom);
  const saveCodeSeconds = useSetAtom(saveCodeSecondsAtom);
  const saveOneCodeSeconds = useSetAtom(saveOneCodeSecondsAtom);

  useSecondsSubmit(() => {
    const parsed = parseSecondsInput(value);
    if (parsed.error) {
      setFormError(parsed.error);
      notify(parsed.error, "error");
      return;
    }
    if (parsed.value == null) {
      setFormError("Nhập thời gian hoàn thành.");
      notify("Nhập thời gian hoàn thành.", "error");
      return;
    }

    if (scope === "all") {
      const overrideKeys = typeOrders
        .filter(
          (order) =>
            typeof order.seconds === "number" && Number.isFinite(order.seconds),
        )
        .map((order) => recordKey(order));
      if (overrideKeys.length) {
        const cleared = saveOrdersSeconds(overrideKeys, null);
        if (cleared.error) {
          setFormError(cleared.error);
          notify(cleared.error, "error");
          return;
        }
      }
      const result = saveTypeSeconds(orderType, value);
      if (result.error) {
        setFormError(result.error);
        notify(result.error, "error");
        return;
      }
      notify(`Đã lưu số giây cho tất cả mã của ${typeLabel || "công đoạn"}.`);
      onClose();
      return;
    }

    if (isEdit && entry?.kind === "order") {
      const result = saveOrderSeconds(
        entry.order.code,
        entry.order.type,
        parsed.value,
        getOrderKind(entry.order),
      );
      if (result.error) {
        setFormError(result.error);
        notify(result.error, "error");
        return;
      }
      notify(`Đã lưu số giây cho ${entry.order.code}.`);
      onClose();
      return;
    }

    if (isEdit && entry?.kind === "code") {
      const result = saveOneCodeSeconds(entry.code, entry.type, value);
      if (result.error) {
        setFormError(result.error);
        notify(result.error, "error");
        return;
      }
      notify(`Đã lưu số giây cho ${entry.code}.`);
      onClose();
      return;
    }

    if (scope === "pd") {
      if (pdPreview.valid.length === 0) {
        setFormError("Nhập ít nhất một mã PD, mỗi dòng một mã.");
        notify("Nhập ít nhất một mã PD.", "error");
        return;
      }
      if (pdPreview.valid.length > MAX_ORDERS_PER_ENTRY) {
        const message = `Mỗi lần nhập tối đa ${MAX_ORDERS_PER_ENTRY} đơn.`;
        setFormError(message);
        notify(message, "error");
        return;
      }
      const result = saveCodeSeconds(orderType, pdPreview.valid, value);
      if (result.error) {
        setFormError(result.error);
        notify(result.error, "error");
        return;
      }
      const created = addOrders(
        result.codes,
        session?.employeeId,
        orderType,
        "",
        parsed.value,
        "pd",
      );
      if (created.error) {
        setFormError(created.error);
        notify(created.error, "error");
        return;
      }
      const parts = [];
      if (created.added.length) {
        parts.push(`Đã thêm ${created.added.length} mã PD.`);
      }
      if (created.duplicates.length) {
        parts.push(`Đã cập nhật ${created.duplicates.length} mã đã có.`);
      }
      parts.push(`Đã lưu số giây cho ${result.codes.length} mã PD.`);
      notify(parts.join(" "));
      onClose();
    }
  });

  return (
    <>
      <ApplyScope scopes={[SCOPES[0], PD_SCOPE]} />
      {!isEdit && scope === "pd" ? <PdCodesField /> : null}
      <SecondsField />
    </>
  );
}
