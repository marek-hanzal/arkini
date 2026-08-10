import type { EditorRoll } from "~/bridge/item/editor/EditorItemModel";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { EditorNumberControl } from "~/ui/form/EditorValueControls";
import { EditorDropList } from "~/ui/item/editor/EditorDropList";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorQuantityControl } from "~/ui/item/editor/EditorQuantityControl";
import { useEditorItemOptionLabel } from "~/ui/item/editor/useEditorItemOptionLabel";

type EditorWeightedRoll = Extract<
	EditorRoll,
	{
		readonly type: "weight";
	}
>;

/** Edits selections and the non-empty candidate collection of one weighted roll. */
export const EditorWeightedRollControl = ({
	onChange,
	roll,
}: {
	readonly onChange: (roll: EditorRoll | undefined) => void;
	readonly roll: EditorWeightedRoll;
}) => {
	const readItemLabel = useEditorItemOptionLabel();
	return (
		<div className="grid gap-4">
			<EditorQuantityControl
				label="Selections"
				value={roll.quantity}
				onChange={(quantity) =>
					onChange({
						...roll,
						quantity,
					})
				}
			/>
			<EditorFormSectionDivider
				description="Relative weighted alternatives considered by this roll."
				title="Weighted candidates"
				variant="secondary"
			/>
			<EditorCollectionSelector
				addLabel="Add weighted candidate"
				count={roll.drop.length}
				itemLabel={(candidateIndex) => {
					const itemId = roll.drop[candidateIndex].drop[0]?.itemId;
					return readItemLabel(itemId ?? "", `Candidate ${candidateIndex + 1}`);
				}}
				label="Weighted candidates"
				onAdd={() =>
					onChange({
						...roll,
						drop: [
							...roll.drop,
							{
								weight: 1,
								drop: [
									structuredClone(EditorItemDraftDefaults.drop),
								],
							},
						],
					})
				}
				onRemove={(candidateIndex) =>
					roll.drop.length <= 2
						? onChange(undefined)
						: onChange({
								...roll,
								drop: roll.drop.filter(
									(_current, currentIndex) => currentIndex !== candidateIndex,
								) as typeof roll.drop,
							})
				}
				removeLabel="Remove weighted candidate"
			>
				{(candidateIndex) => {
					const candidate = roll.drop[candidateIndex];
					const removeCandidate = () =>
						roll.drop.length <= 2
							? onChange(undefined)
							: onChange({
									...roll,
									drop: roll.drop.filter(
										(_current, currentIndex) => currentIndex !== candidateIndex,
									) as typeof roll.drop,
								});
					return (
						<div className="grid gap-3">
							<EditorNumberControl
								label={`Candidate ${candidateIndex + 1} weight`}
								value={candidate.weight}
								min={1}
								onChange={(weight) =>
									onChange({
										...roll,
										drop: roll.drop.map((current, currentIndex) =>
											currentIndex === candidateIndex
												? {
														...current,
														weight,
													}
												: current,
										) as typeof roll.drop,
									})
								}
							/>
							<EditorDropList
								value={candidate.drop}
								onChange={(drop) =>
									drop === undefined
										? removeCandidate()
										: onChange({
												...roll,
												drop: roll.drop.map((current, currentIndex) =>
													currentIndex === candidateIndex
														? {
																...current,
																drop,
															}
														: current,
												) as typeof roll.drop,
											})
								}
							/>
						</div>
					);
				}}
			</EditorCollectionSelector>
		</div>
	);
};
