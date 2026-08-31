import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { InputControl } from "~/production-authoring/ui/InputControl";
import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";
import { useEditorItemOptionLabel } from "~/authoring-form/ui/useEditorItemSearchOptions";

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
	const readItemLabelFn = useEditorItemOptionLabel();
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
						: "Optional requirements settled when this action activates. Simple can spend an owner charge, while Deposit targets and may spend charges from a matching board item."
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
						return `${readItemLabelFn(input.selector.itemId, `Material input ${index + 1}`)} — Materials`;
					if (input.type === "deposit")
						return `${readItemLabelFn(input.query.selector.itemId, `Deposit input ${index + 1}`)} — Deposit`;
					return `Simple input ${index + 1}`;
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
			>
				{(index) => (
					<InputControl
						allowMaterials={allowMaterials}
						input={value[index]}
						onChangeFn={(next) => replaceAtFn(index, next)}
					/>
				)}
			</EditorCollectionSelector>
		</section>
	);
};
