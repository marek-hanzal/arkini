import { useFormSession } from "~/item-authoring/ui/FormContext";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";
import { RollSetControl } from "~/production-authoring/ui/RollSetControl";
import { OutcomeOption } from "~/production-authoring/ui/OutcomeOption";
import { readDraftRollOutcomesFn } from "~/production-authoring/fn/readDraftRollOutcomesFn";
import { useEditorItemOptionLabel } from "~/authoring-form/ui/useEditorItemSearchOptions";
import {
	useFormValidationFocusIndex,
	useFormValidationIssues,
} from "~/item-authoring/ui/useFormValidationIssues";
import { readRequiredEditorCollectionErrorFn } from "~/editor-control/fn/readRequiredEditorCollectionErrorFn";
import { useTranslator } from "~/translation/ui/useTranslator";

interface OutcomeControlProps {
	readonly onChangeFn: (outcome: OutcomeTableSchema.Type | undefined) => void;
	readonly value: OutcomeTableSchema.Type | undefined;
}

/** Edits weighted outcome sets through their concrete RollSet domain. */
export const OutcomeControl = ({ onChangeFn, value }: OutcomeControlProps) => {
	const translator = useTranslator();
	const { outcomeSetIndex, outcomeRollIndex, outcomeIndex, ruleIndex, whenIndex } =
		useFormSession();
	const readItemLabelFn = useEditorItemOptionLabel();
	const validationIssues = useFormValidationIssues(value);
	const sets = value?.set ?? [];
	const invalidSetIndex = useFormValidationFocusIndex(value, "set");
	return (
		<section className="grid gap-3">
			<EditorCollectionSelector
				dataUi="EditorOutcomeSetsCollection"
				count={sets.length}
				error={readRequiredEditorCollectionErrorFn(
					validationIssues,
					sets.length,
					1,
					translator.textFn("Add at least one outcome set."),
					"set",
				)}
				initialSelectedIndex={outcomeSetIndex}
				key={outcomeSetIndex}
				itemLabelFn={(index) => {
					const roll = sets[index]?.roll[0];
					const label =
						roll === undefined
							? ""
							: readDraftRollOutcomesFn(roll)
									.map((outcome) =>
										outcome.type === "item"
											? readItemLabelFn(
													outcome.itemId,
													translator.textFn("No item selected"),
												)
											: `${translator.textFn("Space")} ${outcome.space}`,
									)
									.join(", ");
					return `${translator.textFn("Outcome set")} ${index + 1} — ${label || translator.textFn("No outcome configured.")}`;
				}}
				itemSearchTermsFn={(index) =>
					(sets[index]?.roll ?? [])
						.flatMap(readDraftRollOutcomesFn)
						.flatMap((outcome) => [
							...(outcome.type === "item"
								? [
										outcome.itemId,
										readItemLabelFn(outcome.itemId, ""),
									]
								: [
										`Space ${outcome.space}`,
									]),
						])
				}
				renderItemContentFn={(index, label) => (
					<OutcomeOption
						label={label}
						outcomes={(sets[index]?.roll ?? []).flatMap(readDraftRollOutcomesFn)}
					/>
				)}
				label={translator.textFn("Outcome sets")}
				onAddFn={() =>
					onChangeFn({
						set: [
							...sets,
							structuredClone(DraftDefaults.outcome.set[0]),
						] as OutcomeTableSchema.Type["set"],
					})
				}
				onDuplicateFn={(index) =>
					onChangeFn({
						set: [
							...sets.slice(0, index + 1),
							structuredClone(sets[index]),
							...sets.slice(index + 1),
						] as OutcomeTableSchema.Type["set"],
					})
				}
				onRemoveFn={(index) =>
					sets.length === 1
						? onChangeFn(undefined)
						: onChangeFn({
								set: sets.filter(
									(_current, currentIndex) => currentIndex !== index,
								) as OutcomeTableSchema.Type["set"],
							})
				}
				selectedIndex={invalidSetIndex}
			>
				{(index) => {
					const set = sets[index];
					return set === undefined ? null : (
						<RollSetControl
							initialRuleIndex={index === outcomeSetIndex ? ruleIndex : undefined}
							initialWhenIndex={index === outcomeSetIndex ? whenIndex : undefined}
							index={index}
							showWeight={sets.length > 1}
							initialRollIndex={
								index === outcomeSetIndex ? outcomeRollIndex : undefined
							}
							initialOutcomeIndex={
								index === outcomeSetIndex ? outcomeIndex : undefined
							}
							value={set}
							onChangeFn={(next) =>
								onChangeFn({
									set: sets.map((current, currentIndex) =>
										currentIndex === index ? next : current,
									) as OutcomeTableSchema.Type["set"],
								})
							}
						/>
					);
				}}
			</EditorCollectionSelector>
		</section>
	);
};
