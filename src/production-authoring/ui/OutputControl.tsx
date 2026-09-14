import { useFormSession } from "~/item-authoring/ui/FormContext";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { RollSchema } from "~/production-output/schema/RollSchema";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";
import { RollSetControl } from "~/production-authoring/ui/RollSetControl";
import { OutputDropOption } from "~/production-authoring/ui/OutputDropOption";
import { readDraftRollDropsFn } from "~/production-authoring/fn/readDraftRollDropsFn";
import { useEditorItemOptionLabel } from "~/authoring-form/ui/useEditorItemSearchOptions";
import {
	useFormValidationFocusIndex,
	useFormValidationIssues,
} from "~/item-authoring/ui/useFormValidationIssues";
import { readRequiredEditorCollectionErrorFn } from "~/editor-control/fn/readRequiredEditorCollectionErrorFn";
import { useTranslator } from "~/translation/ui/useTranslator";

const readFirstRollItemIdFn = (roll: RollSchema.Type): string | undefined =>
	readDraftRollDropsFn(roll)[0]?.itemId;

interface OutputControlProps {
	readonly onChangeFn: (output: OutputSchema.Type | undefined) => void;
	readonly value: OutputSchema.Type | undefined;
}

/** Edits weighted output sets through their concrete RollSet domain. */
export const OutputControl = ({ onChangeFn, value }: OutputControlProps) => {
	const translator = useTranslator();
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
	const invalidSetIndex = useFormValidationFocusIndex(value, "set");
	return (
		<section className="grid gap-3">
			<EditorCollectionSelector
				dataUi="EditorOutputSetsCollection"
				count={sets.length}
				error={readRequiredEditorCollectionErrorFn(
					validationIssues,
					sets.length,
					1,
					translator.textFn("Add at least one output set."),
					"set",
				)}
				initialSelectedIndex={outputSetIndex}
				key={outputSetIndex}
				itemLabelFn={(index) => {
					const roll = sets[index]?.roll[0];
					const itemId = roll === undefined ? undefined : readFirstRollItemIdFn(roll);
					return `${translator.textFn("Output set")} ${index + 1} — ${readItemLabelFn(
						itemId ?? "",
						translator.textFn("No item selected"),
					)}`;
				}}
				itemSearchTermsFn={(index) =>
					(sets[index]?.roll ?? []).flatMap(readDraftRollDropsFn).flatMap((drop) => [
						drop.itemId,
						readItemLabelFn(drop.itemId, ""),
					])
				}
				renderItemContentFn={(index, label) => (
					<OutputDropOption
						label={label}
						drops={(sets[index]?.roll ?? []).flatMap(readDraftRollDropsFn)}
					/>
				)}
				label={translator.textFn("Output sets")}
				onAddFn={() =>
					onChangeFn({
						set: [
							...sets,
							structuredClone(DraftDefaults.output.set[0]),
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
								onChangeFn({
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
