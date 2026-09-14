import { useFormSession } from "~/item-authoring/ui/FormContext";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { RollSchema } from "~/production-output/schema/RollSchema";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";
import { RollSetControl } from "~/production-authoring/ui/RollSetControl";
import { OutputDropOption } from "~/production-authoring/ui/OutputDropOption";
import { readRollDropsFn } from "~/production-output/fn/readRollDropsFn";
import { useEditorItemOptionLabel } from "~/authoring-form/ui/useEditorItemSearchOptions";
import { useFormValidationIssues } from "~/item-authoring/ui/useFormValidationIssues";

const readFirstRollItemIdFn = (roll: RollSchema.Type): string | undefined =>
	roll.type === "weight" ? roll.drop[0]?.drop[0]?.itemId : roll.drop[0]?.itemId;

interface OutputControlProps {
	readonly onChangeFn: (output: OutputSchema.Type | undefined) => void;
	readonly value: OutputSchema.Type | undefined;
}

/** Edits weighted output sets through their concrete RollSet domain. */
export const OutputControl = ({ onChangeFn, value }: OutputControlProps) => {
	const {
		outputSetIndex,
		outputRollIndex,
		outputDropIndex,
		outputCandidateIndex,
		ruleIndex,
		whenIndex,
	} = useFormSession();
	const readItemLabelFn = useEditorItemOptionLabel();
	const validationIssues = useFormValidationIssues(value);
	const sets = value?.set ?? [];
	const invalidSetIndex = validationIssues.find(
		(issue) => issue.path[0] === "set" && typeof issue.path[1] === "number",
	)?.path[1] as number | undefined;
	return (
		<section className="grid gap-3">
			<EditorCollectionSelector
				addLabel="Add output set"
				count={sets.length}
				initialSelectedIndex={outputSetIndex}
				key={outputSetIndex}
				itemLabelFn={(index) => {
					const roll = sets[index]?.roll[0];
					const itemId = roll === undefined ? undefined : readFirstRollItemIdFn(roll);
					return `Output set ${index + 1} — ${readItemLabelFn(
						itemId ?? "",
						"No item selected",
					)}`;
				}}
				itemSearchTermsFn={(index) =>
					(sets[index]?.roll ?? []).flatMap(readRollDropsFn).flatMap((drop) => [
						drop.itemId,
						readItemLabelFn(drop.itemId, ""),
					])
				}
				renderItemContentFn={(index, label) => (
					<OutputDropOption
						label={label}
						drops={(sets[index]?.roll ?? []).flatMap(readRollDropsFn)}
					/>
				)}
				label="Output sets"
				onAddFn={() =>
					onChangeFn({
						set: [
							...sets,
							{
								weight: 1,
								roll: [
									structuredClone(DraftDefaults.rolls.guaranteed),
								],
							},
						] as OutputSchema.Type["set"],
					})
				}
				onRemoveFn={(index) =>
					sets.length === 1
						? onChangeFn(undefined)
						: onChangeFn({
								set: sets.filter(
									(_current, currentIndex) => currentIndex !== index,
								) as OutputSchema.Type["set"],
							})
				}
				removeLabel="Remove output set"
				selectedIndex={invalidSetIndex}
			>
				{(index) => {
					const set = sets[index];
					return set === undefined ? null : (
						<RollSetControl
							initialRuleIndex={index === outputSetIndex ? ruleIndex : undefined}
							initialWhenIndex={index === outputSetIndex ? whenIndex : undefined}
							index={index}
							initialRollIndex={
								index === outputSetIndex ? outputRollIndex : undefined
							}
							initialDropIndex={
								index === outputSetIndex ? outputDropIndex : undefined
							}
							initialCandidateIndex={
								index === outputSetIndex ? outputCandidateIndex : undefined
							}
							value={set}
							onChangeFn={(next) =>
								next === undefined
									? sets.length === 1
										? onChangeFn(undefined)
										: onChangeFn({
												set: sets.filter(
													(_current, currentIndex) =>
														currentIndex !== index,
												) as OutputSchema.Type["set"],
											})
									: onChangeFn({
											set: sets.map((current, currentIndex) =>
												currentIndex === index ? next : current,
											) as OutputSchema.Type["set"],
										})
							}
						/>
					);
				}}
			</EditorCollectionSelector>
		</section>
	);
};
