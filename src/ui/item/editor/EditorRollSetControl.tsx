import type { RollSchema } from "~/engine/roll/schema/RollSchema";
import type { SetSchema } from "~/engine/roll/schema/SetSchema";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { EditorNumberControl } from "~/ui/form/EditorValueControls";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorRollControl } from "~/ui/item/editor/EditorRollControl";
import { useEditorItemOptionLabel } from "~/ui/item/editor/useEditorItemOptionLabel";

const readFirstRollItemId = (roll: RollSchema.Type): string | undefined =>
	roll.type === "weight" ? roll.drop[0]?.drop[0]?.itemId : roll.drop[0]?.itemId;

export const EditorRollSetControl = ({
	index,
	onChange,
	value,
}: {
	readonly index: number;
	readonly onChange: (set: SetSchema.Type | undefined) => void;
	readonly value: SetSchema.Type;
}) => {
	const readItemLabel = useEditorItemOptionLabel();
	return (
		<section className="grid gap-3">
			<EditorNumberControl
				label="Relative set weight"
				value={value.weight}
				min={1}
				onChange={(weight) =>
					onChange({
						...value,
						weight,
					})
				}
			/>
			<EditorFormSectionDivider
				description="Independent rolls resolved by this weighted output set."
				title="Rolls"
				variant="secondary"
			/>
			<EditorCollectionSelector
				addLabel="Add roll"
				count={value.roll.length}
				itemLabel={(rollIndex) => {
					const roll = value.roll[rollIndex];
					const itemId = readFirstRollItemId(roll);
					return `${roll.type} roll ${rollIndex + 1} — ${readItemLabel(
						itemId ?? "",
						"No item selected",
					)}`;
				}}
				label={`Output set ${index + 1} rolls`}
				onAdd={() =>
					onChange({
						...value,
						roll: [
							...value.roll,
							structuredClone(EditorItemDraftDefaults.rolls.guaranteed),
						],
					})
				}
				onRemove={(rollIndex) =>
					value.roll.length === 1
						? onChange(undefined)
						: onChange({
								...value,
								roll: value.roll.filter(
									(_current, currentIndex) => currentIndex !== rollIndex,
								) as typeof value.roll,
							})
				}
				removeLabel="Remove roll"
			>
				{(rollIndex) => (
					<EditorRollControl
						value={value.roll[rollIndex]}
						onChange={(next) =>
							next === undefined
								? value.roll.length === 1
									? onChange(undefined)
									: onChange({
											...value,
											roll: value.roll.filter(
												(_current, currentIndex) =>
													currentIndex !== rollIndex,
											) as typeof value.roll,
										})
								: onChange({
										...value,
										roll: value.roll.map((current, currentIndex) =>
											currentIndex === rollIndex ? next : current,
										) as typeof value.roll,
									})
						}
					/>
				)}
			</EditorCollectionSelector>
		</section>
	);
};
