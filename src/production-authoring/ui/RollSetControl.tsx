import { match } from "ts-pattern";

import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";
import { QuantityControl } from "~/production-authoring/ui/QuantityControl";
import { RulesControl } from "~/production-authoring/ui/RulesControl";
import type { DropSchema } from "~/production-output/schema/DropSchema";
import type { RollSchema } from "~/production-output/schema/RollSchema";
import type { RollSetSchema } from "~/production-output/schema/RollSetSchema";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { OutputDropOption } from "~/production-authoring/ui/OutputDropOption";
import {
	readDraftRollDropsFn,
	type DraftRoll,
} from "~/production-authoring/fn/readDraftRollDropsFn";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { SectionEnd } from "~/ui/ui/SectionEnd";
import { EditorChoiceControl, EditorNumberControl } from "~/editor-control/ui/EditorValueControls";
import { EditorItemReferenceControl } from "~/authoring-form/ui/EditorItemAutocompleteField";
import { useEditorItemOptionLabel } from "~/authoring-form/ui/useEditorItemSearchOptions";
import { EditorItemSearchThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import {
	useFormValidationFocusIndex,
	useFormValidationIssues,
} from "~/item-authoring/ui/useFormValidationIssues";
import { readEditorFormValidationErrorFn } from "~/editor-control/fn/readEditorFormValidationErrorFn";
import { readRequiredEditorCollectionErrorFn } from "~/editor-control/fn/readRequiredEditorCollectionErrorFn";
import { Mx } from "~/translation/ui/Mx";
import { useTranslator } from "~/translation/ui/useTranslator";

type DropListValue = DropSchema.Type[];
const readChancePercentFn = (chance: number) => Number((chance * 100).toFixed(6));
const readDropSummaryFn = (drop: DropSchema.Type, textFn: (key: string) => string) => {
	const { min, max } = drop.quantity;
	const quantity = min === max ? `×${min}` : `×${min}–${max}`;
	const placement = textFn(drop.placement === "drop" ? "Local drop" : "Random");
	const rules = drop.rules.length;
	return `${quantity} · ${placement}${rules === 0 ? "" : ` · ${rules} ${textFn(rules === 1 ? "rule" : "rules")}`}`;
};
const RollTypeLabelByType = {
	chance: "Chance",
	guaranteed: "Guaranteed",
} as const satisfies Record<RollSchema.Type["type"], string>;

const DropControl = ({
	initialRuleIndex,
	initialWhenIndex,
	onChangeFn,
	value,
}: {
	readonly onChangeFn: (drop: DropSchema.Type) => void;
	readonly initialRuleIndex?: number;
	readonly initialWhenIndex?: number;
	readonly value: DropSchema.Type;
}) => {
	const validationIssues = useFormValidationIssues(value);
	const translator = useTranslator();
	return (
		<div className="grid gap-3">
			<EditorItemReferenceControl
				error={readEditorFormValidationErrorFn(validationIssues, "itemId")}
				label={translator.textFn("Dropped item")}
				value={value.itemId}
				onChangeFn={(itemId) =>
					onChangeFn({
						...value,
						itemId,
					})
				}
			/>
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="min-w-0 basis-full sm:basis-1/2">
					<QuantityControl
						minimumError={readEditorFormValidationErrorFn(
							validationIssues,
							"quantity",
							"min",
						)}
						maximumError={readEditorFormValidationErrorFn(
							validationIssues,
							"quantity",
							"max",
						)}
						value={value.quantity}
						onChangeFn={(quantity) =>
							onChangeFn({
								...value,
								quantity,
							})
						}
					/>
				</div>
				<EditorChoiceControl
					error={readEditorFormValidationErrorFn(validationIssues, "placement")}
					label={translator.textFn("Board placement")}
					value={value.placement}
					options={[
						{
							description: <Mx label="Local drop placement help" />,
							label: translator.textFn("Local drop"),
							value: "drop",
						},
						{
							description: <Mx label="Random drop placement help" />,
							label: translator.textFn("Random"),
							value: "random",
						},
					]}
					onChangeFn={(placement) =>
						onChangeFn({
							...value,
							placement,
						})
					}
				/>
			</div>
			<SectionEnd />
			<RulesControl
				initialRuleIndex={initialRuleIndex}
				initialWhenIndex={initialWhenIndex}
				rules={value.rules}
				target="drop"
				description={<Mx label="Drop rules help" />}
				allowedTypes={[
					"enable",
					"disable",
				]}
				onChangeFn={(rules) =>
					onChangeFn({
						...value,
						rules: rules as DropSchema.Type["rules"],
					})
				}
			/>
		</div>
	);
};

const DropList = ({
	initialRuleIndex,
	initialWhenIndex,
	initialDropIndex,
	onChangeFn,
	value,
}: {
	readonly initialDropIndex?: number;
	readonly onChangeFn: (drops: DropListValue) => void;
	readonly initialRuleIndex?: number;
	readonly initialWhenIndex?: number;
	readonly value: DropListValue;
}) => {
	const readItemLabelFn = useEditorItemOptionLabel();
	const project = useEditorProject();
	const items = project.config?.items ?? {};
	const translator = useTranslator();
	const validationIssues = useFormValidationIssues(value);
	const invalidDropIndex = useFormValidationFocusIndex(value as object);
	return (
		<section className="grid gap-3">
			<EditorFormSectionDivider
				description={<Mx label="Drops help" />}
				title={translator.textFn("Drops")}
				variant="secondary"
			/>
			<EditorCollectionSelector
				dataUi="EditorDropsCollection"
				count={value.length}
				error={readRequiredEditorCollectionErrorFn(
					validationIssues,
					value.length,
					1,
					translator.textFn("Add at least one drop."),
				)}
				initialSelectedIndex={initialDropIndex}
				key={initialDropIndex}
				itemLabelFn={(index) =>
					`${translator.textFn("Drop")} ${index + 1} — ${readItemLabelFn(
						value[index].itemId,
						translator.textFn("No item selected"),
					)}`
				}
				itemSearchTermsFn={(index) => [
					value[index].itemId,
				]}
				label={translator.textFn("Drops")}
				itemMetaFn={(index) => readDropSummaryFn(value[index], translator.textFn)}
				renderItemContentFn={(index, label) => (
					<OutputDropOption
						label={label}
						drops={[
							value[index],
						]}
						summary={readDropSummaryFn(value[index], translator.textFn)}
					/>
				)}
				renderSelectedItemPreviewFn={(index) => (
					<EditorItemSearchThumbnail
						item={index === undefined ? undefined : items[value[index].itemId]}
						selected
					/>
				)}
				onAddFn={() =>
					onChangeFn([
						...value,
						structuredClone(DraftDefaults.drop),
					])
				}
				onDuplicateFn={(index) =>
					onChangeFn([
						...value.slice(0, index + 1),
						structuredClone(value[index]),
						...value.slice(index + 1),
					])
				}
				onRemoveFn={(index) =>
					onChangeFn(value.filter((_current, currentIndex) => currentIndex !== index))
				}
				selectedIndex={invalidDropIndex}
			>
				{(index) => (
					<DropControl
						initialRuleIndex={index === initialDropIndex ? initialRuleIndex : undefined}
						initialWhenIndex={index === initialDropIndex ? initialWhenIndex : undefined}
						value={value[index]}
						onChangeFn={(next) =>
							onChangeFn(
								value.map((current, currentIndex) =>
									currentIndex === index ? next : current,
								) as DropListValue,
							)
						}
					/>
				)}
			</EditorCollectionSelector>
		</section>
	);
};

const RollControl = ({
	initialRuleIndex,
	initialWhenIndex,
	initialDropIndex,
	onChangeFn,
	value,
}: {
	readonly initialDropIndex?: number;
	readonly onChangeFn: (roll: RollSchema.Type) => void;
	readonly initialRuleIndex?: number;
	readonly initialWhenIndex?: number;
	readonly value: DraftRoll;
}) => {
	const validationIssues = useFormValidationIssues(value);
	const translator = useTranslator();
	return (
		<div className="grid gap-4">
			<div className="flex min-w-0 justify-end">
				<EditorChoiceControl
					error={readEditorFormValidationErrorFn(validationIssues, "type")}
					label={translator.textFn("Roll type")}
					value={value.type}
					options={[
						{
							description: <Mx label="Guaranteed roll type help" />,
							label: translator.textFn("Guaranteed"),
							value: "guaranteed",
						},
						{
							description: <Mx label="Chance roll type help" />,
							label: translator.textFn("Chance"),
							value: "chance",
						},
					]}
					onChangeFn={(type) => onChangeFn(structuredClone(DraftDefaults.rolls[type]))}
				/>
			</div>
			{value.type === undefined
				? null
				: match(value as RollSchema.Type)
						.with(
							{
								type: "guaranteed",
							},
							(roll) => (
								<DropList
									initialRuleIndex={initialRuleIndex}
									initialWhenIndex={initialWhenIndex}
									value={roll.drop}
									initialDropIndex={initialDropIndex}
									onChangeFn={(drop) =>
										onChangeFn({
											...roll,
											drop: drop as typeof roll.drop,
										})
									}
								/>
							),
						)
						.with(
							{
								type: "chance",
							},
							(roll) => (
								<div className="grid gap-3">
									<EditorNumberControl
										error={readEditorFormValidationErrorFn(
											validationIssues,
											"chance",
										)}
										description={<Mx label="Chance percentage help" />}
										label={translator.textFn("Chance (%)")}
										value={readChancePercentFn(roll.chance)}
										min={0}
										max={100}
										step={5}
										onChangeFn={(chancePercent) =>
											onChangeFn({
												...roll,
												chance: Math.round(chancePercent) / 100,
											})
										}
									/>
									<DropList
										initialRuleIndex={initialRuleIndex}
										initialWhenIndex={initialWhenIndex}
										value={roll.drop}
										initialDropIndex={initialDropIndex}
										onChangeFn={(drop) =>
											onChangeFn({
												...roll,
												drop: drop as typeof roll.drop,
											})
										}
									/>
								</div>
							),
						)
						.exhaustive()}
		</div>
	);
};

export const RollSetControl = ({
	initialRuleIndex,
	initialWhenIndex,
	index,
	showWeight,
	initialRollIndex,
	initialDropIndex,
	onChangeFn,
	value,
}: {
	readonly index: number;
	readonly showWeight: boolean;
	readonly initialRollIndex?: number;
	readonly initialDropIndex?: number;
	readonly onChangeFn: (set: RollSetSchema.Type) => void;
	readonly initialRuleIndex?: number;
	readonly initialWhenIndex?: number;
	readonly value: RollSetSchema.Type;
}) => {
	const readItemLabelFn = useEditorItemOptionLabel();
	const translator = useTranslator();
	const validationIssues = useFormValidationIssues(value);
	const invalidRollIndex = useFormValidationFocusIndex(value, "roll");
	return (
		<section className="grid gap-3">
			{showWeight ? (
				<EditorNumberControl
					description={<Mx label="Output set weight help" />}
					error={readEditorFormValidationErrorFn(validationIssues, "weight")}
					label={translator.textFn("Relative set weight")}
					value={value.weight}
					min={1}
					onChangeFn={(weight) =>
						onChangeFn({
							...value,
							weight,
						})
					}
				/>
			) : null}
			<RulesControl
				initialRuleIndex={initialRollIndex === undefined ? initialRuleIndex : undefined}
				initialWhenIndex={initialRollIndex === undefined ? initialWhenIndex : undefined}
				rules={value.rules}
				target="set"
				label={translator.textFn("Set rules")}
				description={<Mx label="Output set rules help" />}
				allowedTypes={[
					"enable",
					"disable",
				]}
				onChangeFn={(rules) =>
					onChangeFn({
						...value,
						rules: rules as RollSetSchema.Type["rules"],
					})
				}
			/>

			<EditorFormSectionDivider
				description={<Mx label="Rolls help" />}
				required
				title={translator.textFn("Rolls")}
				variant="secondary"
			/>
			<EditorCollectionSelector
				dataUi="EditorRollsCollection"
				count={value.roll.length}
				error={readRequiredEditorCollectionErrorFn(
					validationIssues,
					value.roll.length,
					1,
					translator.textFn("Add at least one roll."),
					"roll",
				)}
				initialSelectedIndex={initialRollIndex}
				key={initialRollIndex}
				itemLabelFn={(rollIndex) => {
					const roll = value.roll[rollIndex];
					return `${translator.textFn(roll.type === undefined ? "Roll" : RollTypeLabelByType[roll.type])} ${rollIndex + 1} — ${readItemLabelFn(
						readDraftRollDropsFn(roll)[0]?.itemId ?? "",
						translator.textFn("No item selected"),
					)}`;
				}}
				itemSearchTermsFn={(rollIndex) =>
					readDraftRollDropsFn(value.roll[rollIndex]).flatMap((drop) => [
						drop.itemId,
						readItemLabelFn(drop.itemId, ""),
					])
				}
				renderItemContentFn={(rollIndex, label) => (
					<OutputDropOption
						label={label}
						drops={readDraftRollDropsFn(value.roll[rollIndex])}
					/>
				)}
				label={`${translator.textFn("Output set")} ${index + 1} ${translator.textFn("rolls")}`}
				onAddFn={() =>
					onChangeFn({
						...value,
						roll: [
							...value.roll,
							structuredClone(DraftDefaults.roll),
						],
					})
				}
				onDuplicateFn={(rollIndex) =>
					onChangeFn({
						...value,
						roll: [
							...value.roll.slice(0, rollIndex + 1),
							structuredClone(value.roll[rollIndex]),
							...value.roll.slice(rollIndex + 1),
						] as typeof value.roll,
					})
				}
				onRemoveFn={(rollIndex) =>
					onChangeFn({
						...value,
						roll: value.roll.filter(
							(_current, currentIndex) => currentIndex !== rollIndex,
						) as typeof value.roll,
					})
				}
				selectedIndex={invalidRollIndex}
			>
				{(rollIndex) => (
					<RollControl
						initialRuleIndex={
							rollIndex === initialRollIndex ? initialRuleIndex : undefined
						}
						initialWhenIndex={
							rollIndex === initialRollIndex ? initialWhenIndex : undefined
						}
						value={value.roll[rollIndex]}
						initialDropIndex={
							rollIndex === initialRollIndex ? initialDropIndex : undefined
						}
						onChangeFn={(next) =>
							onChangeFn({
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
