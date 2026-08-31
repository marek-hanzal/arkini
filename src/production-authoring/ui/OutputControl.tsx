import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { RollSchema } from "~/production-output/schema/RollSchema";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";
import { RollSetControl } from "~/production-authoring/ui/RollSetControl";
import { useEditorItemOptionLabel } from "~/authoring-form/ui/useEditorItemSearchOptions";

const readFirstRollItemIdFn = (roll: RollSchema.Type): string | undefined =>
	roll.type === "weight" ? roll.drop[0]?.drop[0]?.itemId : roll.drop[0]?.itemId;

interface OutputControlProps {
	readonly onChangeFn: (output: OutputSchema.Type | undefined) => void;
	readonly value: OutputSchema.Type;
}

/** Edits weighted output sets through their concrete RollSet domain. */
export const OutputControl = ({ onChangeFn, value }: OutputControlProps) => {
	const readItemLabelFn = useEditorItemOptionLabel();
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
				itemLabelFn={(index) => {
					const roll = value.set[index].roll[0];
					const itemId = roll === undefined ? undefined : readFirstRollItemIdFn(roll);
					return `Output set ${index + 1} — ${readItemLabelFn(
						itemId ?? "",
						"No item selected",
					)}`;
				}}
				label="Output sets"
				onAddFn={() =>
					onChangeFn({
						set: [
							...value.set,
							{
								weight: 1,
								roll: [
									structuredClone(DraftDefaults.rolls.guaranteed),
								],
							},
						],
					})
				}
				onRemoveFn={(index) =>
					value.set.length === 1
						? onChangeFn(undefined)
						: onChangeFn({
								set: value.set.filter(
									(_current, currentIndex) => currentIndex !== index,
								) as typeof value.set,
							})
				}
				removeLabel="Remove output set"
			>
				{(index) => (
					<RollSetControl
						index={index}
						value={value.set[index]}
						onChangeFn={(next) =>
							next === undefined
								? value.set.length === 1
									? onChangeFn(undefined)
									: onChangeFn({
											set: value.set.filter(
												(_current, currentIndex) => currentIndex !== index,
											) as typeof value.set,
										})
								: onChangeFn({
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
