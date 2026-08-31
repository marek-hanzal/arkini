import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { RollSchema } from "~/production-output/schema/RollSchema";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { EditorProductionDraftDefaults } from "~/production-line-authoring/ui/EditorProductionDraftDefaults";
import { EditorRollSetControl } from "~/production-line-authoring/ui/EditorRollSetControl";
import { useEditorItemOptionLabel } from "~/authoring-form/ui/useEditorItemSearchOptions";

const readFirstRollItemId = (roll: RollSchema.Type): string | undefined =>
	roll.type === "weight" ? roll.drop[0]?.drop[0]?.itemId : roll.drop[0]?.itemId;

interface EditorOutputControlProps {
	readonly onChange: (output: OutputSchema.Type | undefined) => void;
	readonly value: OutputSchema.Type;
}

/** Edits weighted output sets through their concrete RollSet domain. */
export const EditorOutputControl = ({ onChange, value }: EditorOutputControlProps) => {
	const readItemLabel = useEditorItemOptionLabel();
	return (
		<section className="grid gap-3">
			<EditorFormSectionDivider
				description="Weighted alternatives resolved when this output runs. A weight of one is the neutral default."
				title="Output sets"
				variant="secondary"
			/>
			<EditorCollectionSelector
				addLabel="Add output set"
				count={value.set.length}
				itemLabel={(index) => {
					const roll = value.set[index].roll[0];
					const itemId = roll === undefined ? undefined : readFirstRollItemId(roll);
					return `Output set ${index + 1} — ${readItemLabel(
						itemId ?? "",
						"No item selected",
					)}`;
				}}
				label="Output sets"
				onAdd={() =>
					onChange({
						set: [
							...value.set,
							{
								weight: 1,
								roll: [
									structuredClone(EditorProductionDraftDefaults.rolls.guaranteed),
								],
							},
						],
					})
				}
				onRemove={(index) =>
					value.set.length === 1
						? onChange(undefined)
						: onChange({
								set: value.set.filter(
									(_current, currentIndex) => currentIndex !== index,
								) as typeof value.set,
							})
				}
				removeLabel="Remove output set"
			>
				{(index) => (
					<EditorRollSetControl
						index={index}
						value={value.set[index]}
						onChange={(next) =>
							next === undefined
								? value.set.length === 1
									? onChange(undefined)
									: onChange({
											set: value.set.filter(
												(_current, currentIndex) => currentIndex !== index,
											) as typeof value.set,
										})
								: onChange({
										set: value.set.map((current, currentIndex) =>
											currentIndex === index ? next : current,
										) as typeof value.set,
									})
						}
					/>
				)}
			</EditorCollectionSelector>
		</section>
	);
};
