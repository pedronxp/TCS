export type InspectionFormFilter = 'todos' | string;

export function matchesInspectionForm(
  formularioId: string | null | undefined,
  selectedForm: InspectionFormFilter,
) {
  return selectedForm === 'todos' || formularioId === selectedForm;
}
