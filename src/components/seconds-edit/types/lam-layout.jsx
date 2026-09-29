import { useSetAtom } from "jotai";
import { ApplyScope, OrderPickerField, SecondsField } from "../fields";
import { useSecondsEditForm, useSecondsSubmit } from "../context";
import { SCOPES } from "../styles";
import {
  getOrderKind,
  updateOrderSecondsAtom,
  updateOrdersSecondsAtom,
} from "../../../orders";
import {
  parseSecondsInput,
  saveOneTypeSecondsAtom,
} from "../../../settings";

export default function LamLayoutFields() {
  const {
    isEdit,
    entry,
    orderType,
    typeLabel,
    scope,
    selectedKeys,
    value,
    setFormError,
    notify,
    onClose,
  } = useSecondsEditForm();
  const saveTypeSeconds = useSetAtom(saveOneTypeSecondsAtom);
  const saveOrderSeconds = useSetAtom(updateOrderSecondsAtom);
  const saveOrdersSeconds = useSetAtom(updateOrdersSecondsAtom);

  useSecondsSubmit(async () => {
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
      const result = await saveTypeSeconds(orderType, value);
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
      const result = await saveOrderSeconds(
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

    const result = await saveOrdersSeconds(selectedKeys, parsed.value);
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
