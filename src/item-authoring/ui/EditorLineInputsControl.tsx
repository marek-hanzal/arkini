import type { InputSchema as LineInputSchema } from "~/engine/input/schema/InputSchema";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { EditorItemDraftDefaults } from "~/item-authoring/ui/EditorItemDraftDefaults";
import { EditorLineInput } from "~/item-authoring/ui/EditorLineInput";
import { useEditorItemOptionLabel } from "~/item-authoring/ui/useEditorItemOptionLabel";

export interface EditorLineInputsControlProps {
	readonly allowMaterials?: boolean;
	readonly emptyAllowed?: boolean;
	readonly onChange: (inputs: LineInputSchema.Type[]) => void;
	readonly value: ReadonlyArray<LineInputSchema.Type>;
}

/** Assembles immediate input requirements, optionally including Line-owned materials. */
export const EditorLineInputsControl = ({
	allowMaterials = true,
	emptyAllowed = false,
	onChange,
	value,
}: EditorLineInputsControlProps) => {
	const readItemLabel = useEditorItemOptionLabel();
	const replaceAt = (index: number, input: LineInputSchema.Type) => {
		const next = value.map((current, currentIndex) =>
			currentIndex === index ? input : current,
		);
		onChange(next);
	};
	return (
		<section className="grid min-w-0 content-start gap-3">
			<EditorFormSectionDivider
				description={
					allowMaterials
						? "Inputs belong only to this production line. At least one explicit input contract is required, and every configured contract must be satisfiable before a job can start. A Simple input explicitly requires no material."
						: "Optional requirements settled when this action activates. Simple can spend an owner charge, while Deposit targets and may spend charges from a matching board item."
				}
				title="Inputs"
				variant="secondary"
			/>
			<EditorCollectionSelector
				addLabel="Add input"
				count={value.length}
				itemLabel={(index) => {
					const input = value[index];
					if (input.type === "materials")
						return `${readItemLabel(input.selector.itemId, `Material input ${index + 1}`)} — Materials`;
					if (input.type === "deposit")
						return `${readItemLabel(input.query.selector.itemId, `Deposit input ${index + 1}`)} — Deposit`;
					return `Simple input ${index + 1}`;
				}}
				label={allowMaterials ? "Line inputs" : "Action inputs"}
				onAdd={() =>
					onChange([
						...value,
						structuredClone(EditorItemDraftDefaults.inputs.simple),
					])
				}
				onRemove={
					!emptyAllowed && value.length === 1
						? undefined
						: (index) =>
								onChange(
									value.filter(
										(_current, currentIndex) => currentIndex !== index,
									),
								)
				}
				removeLabel="Remove input"
			>
				{(index) => (
					<EditorLineInput
						allowMaterials={allowMaterials}
						input={value[index]}
						onChange={(next) => replaceAt(index, next)}
					/>
				)}
			</EditorCollectionSelector>
		</section>
	);
};
