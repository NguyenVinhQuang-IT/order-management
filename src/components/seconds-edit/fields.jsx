import { recordKey } from "../../orders";
import { useSecondsEditForm } from "./context";
import {
  textFieldClass,
  textLinkClass,
  textareaClass,
} from "./styles";

export function ApplyScope({ scopes }) {
  const { isEdit, entry, scope, setScope, formError, setFormError } =
    useSecondsEditForm();

  return (
    <div className="mb-6 flex flex-col gap-2">
      <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
        Áp dụng
      </span>
      {isEdit ? (
        <input
          className={`${textFieldClass} bg-parchment`}
          type="text"
          value={
            scope === "all"
              ? "Tất cả mã đơn"
              : entry?.kind === "code"
                ? entry.code
                : entry?.order?.code ?? ""
          }
          readOnly
          aria-readonly="true"
        />
      ) : (
        <div
          className={`grid gap-1 border border-black/8 bg-canvas p-1 ${
            scopes.length === 3
              ? "grid-cols-1 auto-rows-[44px] rounded-[18px] tablet:h-11 tablet:grid-cols-3 tablet:auto-rows-auto tablet:rounded-full"
              : "h-11 grid-cols-2 rounded-full"
          }`}
          role="radiogroup"
          aria-label="Áp dụng"
        >
          {scopes.map((item) => {
            const selected = scope === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`h-full cursor-pointer rounded-full border-0 px-1 text-[13px] font-normal leading-none tracking-[-0.224px] tablet:text-[15px] ${
                  selected
                    ? "bg-ink text-white"
                    : "bg-transparent text-ink-muted-80 hover:text-ink"
                }`}
                onClick={() => {
                  setScope(item.id);
                  if (formError) setFormError("");
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PdCodesField() {
  const { pdText, setPdText, pdPreview, formError, setFormError } =
    useSecondsEditForm();

  return (
    <label className="mb-6 flex flex-col gap-2">
      <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
        Mã PD
      </span>
      <textarea
        className={textareaClass}
        name="pdCodes"
        value={pdText}
        onChange={(event) => {
          setPdText(event.target.value);
          if (formError) setFormError("");
        }}
        spellCheck={false}
        autoCapitalize="characters"
        placeholder={"PD001\nPD002"}
        aria-describedby="pd-help"
      />
      <span
        id="pd-help"
        className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-48"
      >
        {pdPreview.valid.length
          ? `${pdPreview.valid.length} mã PD.`
          : "Mỗi dòng một mã PD."}
      </span>
    </label>
  );
}

export function OrderPickerField() {
  const {
    query,
    setQuery,
    selectedKeys,
    typeOrders,
    visibleOrders,
    toggleKey,
    handleSelectVisible,
  } = useSecondsEditForm();

  return (
    <div className="mb-6 flex flex-col gap-2">
      <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
        Mã đơn
      </span>
      {typeOrders.length === 0 ? (
        <p className="m-0 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-48">
          Chưa có đơn ở công đoạn này.
        </p>
      ) : (
        <>
          <input
            className={`${textFieldClass} tabular-nums`}
            type="search"
            name="orderSearch"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-label="Tìm mã đơn"
          />
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-48">
              {selectedKeys.size} đã chọn
            </span>
            <div className="flex items-center gap-4">
              <button
                className={textLinkClass}
                type="button"
                onClick={() => handleSelectVisible(true)}
              >
                Chọn tất cả
              </button>
              <button
                className={textLinkClass}
                type="button"
                onClick={() => handleSelectVisible(false)}
              >
                Bỏ chọn
              </button>
            </div>
          </div>
          <ul className="m-0 max-h-48 list-none overflow-y-auto rounded-[18px] border border-hairline p-0">
            {visibleOrders.length === 0 ? (
              <li className="px-5 py-3 text-sm font-normal leading-[1.43] tracking-[-0.224px] text-ink-muted-48">
                Không có mã khớp.
              </li>
            ) : (
              visibleOrders.map((order, index) => {
                const key = recordKey(order);
                const checked = selectedKeys.has(key);
                return (
                  <li
                    key={key}
                    className={
                      index < visibleOrders.length - 1
                        ? "border-b border-hairline"
                        : ""
                    }
                  >
                    <label
                      className={`flex cursor-pointer items-center gap-3 px-5 py-3 ${
                        checked ? "bg-[#e8f1fb]" : "hover:bg-parchment"
                      }`}
                    >
                      <input
                        className="h-4 w-4 shrink-0 accent-primary"
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleKey(key)}
                      />
                      <span className="text-[17px] font-normal leading-[1.44] tracking-[-0.374px] text-ink tabular-nums">
                        {order.code}
                      </span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </>
      )}
    </div>
  );
}

export function SecondsField() {
  const { secondsRef, value, setValue, formError, setFormError } =
    useSecondsEditForm();

  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold leading-[1.29] tracking-[-0.224px] text-ink">
        Thời gian hoàn thành (giây)
      </span>
      <input
        ref={secondsRef}
        className={`${textFieldClass} tabular-nums`}
        name="seconds"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => {
          setValue(event.target.value.replace(/\D/g, "").slice(0, 5));
          if (formError) setFormError("");
        }}
        required
        aria-required="true"
      />
    </label>
  );
}
