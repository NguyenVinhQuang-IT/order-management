import { ApplyScope, OrderPickerField, SecondsField } from "./fields";
import { useSecondsEditForm } from "./context";
import { SCOPES } from "./styles";

export default function CoTypeFields() {
  const { isEdit, scope, orderType } = useSecondsEditForm();

  return (
    <>
      <SecondsField />
    </>
  );
}
