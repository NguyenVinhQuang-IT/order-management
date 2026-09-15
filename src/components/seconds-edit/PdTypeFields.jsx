import { ApplyScope, PdCodesField, SecondsField } from "./fields";
import { useSecondsEditForm } from "./context";
import { PD_SCOPE, SCOPES } from "./styles";

const PD_SCOPES = [SCOPES[0], PD_SCOPE];

export default function PdTypeFields() {
  const { isEdit, scope } = useSecondsEditForm();

  return (
    <>
      <ApplyScope scopes={PD_SCOPES} />
      {!isEdit && scope === "pd" ? <PdCodesField /> : null}
      <SecondsField />
    </>
  );
}
