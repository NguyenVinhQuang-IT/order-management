import { useAtomValue, useSetAtom } from "jotai";
import { sessionAtom } from "../../../auth";
import {
  addOrdersAtom,
  getOrderKind,
  MAX_ORDERS_PER_ENTRY,
  normalizeOrderCode,
  parseOrderLines,
  updateOrderAtom,
  updateOrderSecondsAtom,
} from "../../../orders";
import { parseSecondsInput } from "../../../settings";
import { useOrderEntryForm, useOrderEntrySubmit } from "../context";
import {
  CodeInputField,
  CodeListField,
  NoteField,
  SecondsField,
} from "../fields";

export default function SapXepSekaFields() {
  const {
    isEdit,
    isManager,
    order,
    orderType,
    text,
    note,
    seconds,
    setFormError,
    notify,
    onClose,
  } = useOrderEntryForm();
  const session = useAtomValue(sessionAtom);
  const addOrders = useSetAtom(addOrdersAtom);
  const updateOrder = useSetAtom(updateOrderAtom);
  const saveOrderSeconds = useSetAtom(updateOrderSecondsAtom);

  useOrderEntrySubmit(async () => {
    if (isEdit) {
      const code = normalizeOrderCode(text);
      if (!code) {
        setFormError("Nhập mã đơn.");
        notify("Nhập mã đơn.", "error");
        return;
      }

      let parsedSeconds = { value: null, error: "" };
      if (isManager) {
        parsedSeconds = parseSecondsInput(seconds);
        if (parsedSeconds.error) {
          setFormError(parsedSeconds.error);
          notify(parsedSeconds.error, "error");
          return;
        }
      }

      const result = await updateOrder(order.code, order.type, {
        code,
        type: orderType,
        note,
        kind: getOrderKind(order),
      });
      if (result.error) {
        setFormError(result.error);
        notify(result.error, "error");
        return;
      }
      if (isManager) {
        const secondsResult = await saveOrderSeconds(
          code,
          orderType,
          parsedSeconds.value,
          getOrderKind(order),
        );
        if (secondsResult.error) {
          setFormError(secondsResult.error);
          notify(secondsResult.error, "error");
          return;
        }
      }
      notify(`Đã cập nhật ${code}.`);
      onClose();
      return;
    }

    const { valid } = parseOrderLines(text);
    if (valid.length === 0) {
      setFormError("Nhập ít nhất một mã đơn, mỗi dòng một mã.");
      notify("Nhập ít nhất một mã đơn.", "error");
      return;
    }
    if (valid.length > MAX_ORDERS_PER_ENTRY) {
      const message = `Mỗi lần nhập tối đa ${MAX_ORDERS_PER_ENTRY} đơn.`;
      setFormError(message);
      notify(message, "error");
      return;
    }

    const result = await addOrders(valid, session?.employeeId, orderType, note);
    if (result.error) {
      setFormError(result.error);
      notify(result.error, "error");
      return;
    }
    const parts = [];
    if (result.added.length) {
      parts.push(`Đã nhập ${result.added.length} đơn hàng.`);
    }
    if (result.duplicates.length) {
      parts.push(`Bỏ qua ${result.duplicates.length} mã trùng.`);
    }
    notify(parts.join(" ") || "Không có đơn mới để nhập.");
    onClose();
  });

  return <>
    <CodeInputField label="Số lượng" placeholder="nhập số lượng seka" />
    <NoteField />
  </>
}
