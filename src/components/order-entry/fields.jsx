import { MAX_ORDERS_PER_ENTRY } from "../../orders";
import { useOrderEntryForm } from "./context";
import { textFieldClass, textareaClass } from "./styles";

export function CodeListField({ label, placeholder, helpEmpty }) {
  const { text, setText, preview, formError, setFormError, handleCtrlEnter } =
    useOrderEntryForm();

  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
        {label}
      </span>
      <textarea
        className={textareaClass}
        name="orders"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          if (formError) setFormError("");
        }}
        onKeyDown={handleCtrlEnter}
        spellCheck={false}
        autoCapitalize="characters"
        placeholder={placeholder}
        aria-describedby="order-help"
      />
      <span
        id="order-help"
        className={`text-sm font-normal leading-[1.43] tracking-[-0.224px] ${
          preview.valid.length > MAX_ORDERS_PER_ENTRY
            ? "text-warn"
            : "text-ink-muted-48"
        }`}
      >
        {preview.valid.length
          ? preview.valid.length > MAX_ORDERS_PER_ENTRY
            ? `${preview.valid.length} mã đơn. Tối đa ${MAX_ORDERS_PER_ENTRY} mã một lần.`
            : `${preview.valid.length} mã đơn.`
          : helpEmpty}
      </span>
    </label>
  );
}

export function CodeInputField({ label, placeholder }) {
  const { text, setText, formError, setFormError, handleCtrlEnter } =
    useOrderEntryForm();

  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
        {label}
      </span>
      <input
        className={`${textFieldClass} tabular-nums`}
        name="orderCode"
        type="text"
        value={text}
        onChange={(event) => {
          setText(event.target.value.toUpperCase());
          if (formError) setFormError("");
        }}
        onKeyDown={handleCtrlEnter}
        spellCheck={false}
        autoCapitalize="characters"
        placeholder={placeholder}
      />
    </label>
  );
}

export function SecondsField() {
  const { seconds, setSeconds, formError, setFormError, handleCtrlEnter } =
    useOrderEntryForm();

  return (
    <label className="mt-6 flex flex-col gap-2">
      <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
        Thời gian hoàn thành (giây)
      </span>
      <input
        className={`${textFieldClass} tabular-nums`}
        name="seconds"
        type="text"
        inputMode="numeric"
        value={seconds}
        onChange={(event) => {
          setSeconds(event.target.value);
          if (formError) setFormError("");
        }}
        onKeyDown={handleCtrlEnter}
        placeholder="Không bắt buộc"
      />
    </label>
  );
}

export function NoteField() {
  const { note, setNote } = useOrderEntryForm();

  return (
    <label className="mt-6 flex flex-col gap-2">
      <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
        Ghi chú
      </span>
      <input
        className={textFieldClass}
        name="note"
        type="text"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Không bắt buộc"
      />
    </label>
  );
}
