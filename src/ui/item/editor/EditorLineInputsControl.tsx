import type { EditorInput, EditorLine } from "~/bridge/item/editor/EditorItemModel";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorLineInput } from "~/ui/item/editor/EditorLineInput";
import { useEditorItemOptionLabel } from "~/ui/item/editor/useEditorItemOptionLabel";

export interface EditorLineInputsControlProps {
	readonly onChange: (inputs: EditorLine["input"]) => void;
	readonly value: EditorLine["input"];
}

/** Assembles every concrete Input requirement owned by one product line. */
export const EditorLineInputsControl = ({ onChange, value }: EditorLineInputsControlProps) => {
	const readItemLabel = useEditorItemOptionLabel();
	const replaceAt = (index: number, input: EditorInput) => {
		const next = value.map((current, currentIndex) =>
			currentIndex === index ? input : current,
		) as EditorLine["input"];
		onChange(next);
	};
	return (
		<section className="grid min-w-0 content-start gap-3">
			<EditorFormSectionDivider
				description="Inputs belong only to this production line. At least one explicit input contract is required, and every configured contract must be satisfiable before a job can start. A Simple input explicitly requires no material."
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
				label="Line inputs"
				onAdd={() =>
					onChange([
						...value,
						structuredClone(EditorItemDraftDefaults.inputs.simple),
					])
				}
				onRemove={
					value.length === 1
						? undefined
						: (index) =>
								onChange(
									value.filter(
										(_current, currentIndex) => currentIndex !== index,
									) as EditorLine["input"],
								)
				}
				removeLabel="Remove input"
			>
				{(index) => (
					<EditorLineInput
						input={value[index]}
						onChange={(next) => replaceAt(index, next)}
					/>
				)}
			</EditorCollectionSelector>
		</section>
	);
};
