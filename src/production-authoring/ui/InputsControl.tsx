import { useTranslator } from "~/translation/ui/useTranslator";
import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { InputControl } from "~/production-authoring/ui/InputControl";
import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";
import { useEditorItemOptionLabel } from "~/authoring-form/ui/useEditorItemSearchOptions";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { useStore } from "@tanstack/react-form";
import { useFormValidationIssues } from "~/item-authoring/ui/useFormValidationIssues";
import { readEditorFormValidationIssuesFn } from "~/editor-control/fn/readEditorFormValidationIssuesFn";

interface InputsControlProps {
	readonly allowMaterials?: boolean;
	readonly emptyAllowed?: boolean;
	readonly onChangeFn: (inputs: LineInputSchema.Type[]) => void;
	readonly value: ReadonlyArray<LineInputSchema.Type>;
}

/** Assembles immediate input requirements, optionally including Line-owned materials. */
export const InputsControl = ({
	allowMaterials = true,
	emptyAllowed = false,
	onChangeFn,
	value,
}: InputsControlProps) => {
	const translator = useTranslator();
	const readItemLabelFn = useEditorItemOptionLabel();
	const { form, itemId } = useFormSession();
	const selfUnitsEnabled = useStore(form.store, (state) => state.values.units !== undefined);
	const validationIssues = useFormValidationIssues(value);
	const issuesByInput = value.map((_input, index) =>
		readEditorFormValidationIssuesFn(validationIssues, [
			index,
		]),
	);
	const invalidInputIndex = issuesByInput.findIndex((issues) => issues.length > 0);
	const replaceAtFn = (index: number, input: LineInputSchema.Type) => {
		const next = value.map((current, currentIndex) =>
			currentIndex === index ? input : current,
		);
		onChangeFn(next);
	};
	return (
		<section className="grid min-w-0 content-start gap-3">
			<EditorFormSectionDivider
				description={
					allowMaterials
						? "Inputs belong only to this production line. At least one explicit input contract is required, and every configured contract must be satisfiable before a job can start. A Simple input explicitly requires no material."
						: translator.textFn(
								"Optional requirements settled when this action activates. Simple adds no external item requirement, while Units spends units from the owner or a matching board item.",
							)
				}
				title="Inputs"
				variant="secondary"
			/>
			<EditorCollectionSelector
				addLabel="Add input"
				count={value.length}
				itemLabelFn={(index) => {
					const input = value[index];
					if (input.type === "materials")
						return `Material input ${index + 1} — ${readItemLabelFn(
							input.selector.itemId,
							"No item selected",
						)}`;
					if (input.type === "units" && input.units?.from === "self")
						return `${translator.textFn("Self-paid units input")} ${index + 1}`;
					if (input.type === "units")
						return `${translator.textFn("Units input")} ${index + 1} — ${readItemLabelFn(
							input.query.selector.itemId,
							"No item selected",
						)}`;
					return `Simple input ${index + 1}`;
				}}
				itemSearchTermsFn={(index) => {
					const input = value[index];
					if (input.type === "materials")
						return [
							input.selector.itemId,
						];
					if (input.type === "units")
						return [
							input.query.selector.itemId,
						];
					return [];
				}}
				label={allowMaterials ? "Line inputs" : "Action inputs"}
				onAddFn={() =>
					onChangeFn([
						...value,
						structuredClone(DraftDefaults.inputs.simple),
					])
				}
				onRemoveFn={
					!emptyAllowed && value.length === 1
						? undefined
						: (index) =>
								onChangeFn(
									value.filter(
										(_current, currentIndex) => currentIndex !== index,
									),
								)
				}
				removeLabel="Remove input"
				selectedIndex={invalidInputIndex < 0 ? undefined : invalidInputIndex}
			>
				{(index) => (
					<InputControl
						allowMaterials={allowMaterials}
						input={value[index]}
						issues={issuesByInput[index]}
						ownerItemId={itemId}
						selfUnitsEnabled={selfUnitsEnabled}
						onChangeFn={(next) => replaceAtFn(index, next)}
					/>
				)}
			</EditorCollectionSelector>
		</section>
	);
};
