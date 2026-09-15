import { useSetAtom } from "jotai";
import { ApplyScope, OrderPickerField, SecondsField } from "../fields";
import { useSecondsEditForm, useSecondsSubmit } from "../context";
import { SCOPES } from "../styles";
import {
  getOrderKind,
  recordKey,
  updateOrderSecondsAtom,
  updateOrdersSecondsAtom,
} from "../../../orders";
import {
  parseSecondsInput,
  saveOneTypeSecondsAtom,
} from "../../../settings";

export default function KiemDonVoiMauFields() {
  const {
    isEdit,
    entry,
    orderType,
    typeLabel,
    scope,
    selectedKeys,
    typeOrders,
    value,
    setFormError,
    notify,
    onClose,
  } = useSecondsEditForm();
  const saveTypeSeconds = useSetAtom(saveOneTypeSecondsAtom);
  const saveOrderSeconds = useSetAtom(updateOrderSecondsAtom);
  const saveOrdersSeconds = useSetAtom(updateOrdersSecondsAtom);

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

    if (selectedKeys.size === 0) {
      setFormError("Chọn ít nhất một mã đơn.");
      notify("Chọn ít nhất một mã đơn.", "error");
      return;
    }

    const result = saveOrdersSeconds(selectedKeys, parsed.value);
    if (result.error) {
      setFormError(result.error);
      notify(result.error, "error");
      return;
    }
    notify(`Đã lưu số giây cho ${selectedKeys.size} mã đơn.`);
    onClose();
  });

  return <SecondsField placeholder={'Thời gian hoàn thành (giây)'} />
}
