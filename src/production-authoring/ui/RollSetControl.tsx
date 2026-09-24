import { readSpaceDestinationLabelFn } from "~/space/fn/readSpaceDestinationLabelFn";
import { SpaceDestinationControl } from "~/authoring-form/ui/SpaceDestinationControl";
import { readOutcomeCollectionSummaryFn } from "~/production-authoring/fn/readOutcomeCollectionSummaryFn";
import { TemplateSelector } from "~/template-authoring/ui/TemplateSelector";
import {
	CircleCheck,
	Dice5,
	History,
	DoorOpen,
	MapPin,
	Sparkles,
	Shuffle,
	PanelsTopLeft,
} from "lucide-react";
import { LinkButton } from "~/ui/ui/LinkButton";
import { match } from "ts-pattern";

import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";
import { QuantityControl } from "~/production-authoring/ui/QuantityControl";
import { RulesControl } from "~/production-authoring/ui/RulesControl";
import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";
import type { RollSchema } from "~/outcome/schema/RollSchema";
import type { RollSetSchema } from "~/outcome/schema/RollSetSchema";
import type { TemplateSchema } from "~/board-template/schema/TemplateSchema";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { OutcomeOption } from "~/production-authoring/ui/OutcomeOption";
import {
	readDraftRollOutcomesFn,
	type DraftRoll,
} from "~/production-authoring/fn/readDraftRollOutcomesFn";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { SectionEnd } from "~/ui/ui/SectionEnd";
import { EditorNumberControl } from "~/editor-control/ui/EditorValueControls";
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

type OutcomeListValue = OutcomeSchema.Type[];
const readChancePercentFn = (chance: number) => Number((chance * 100).toFixed(6));
const readOutcomeSummaryFn = (
	outcome: OutcomeSchema.Type,
	textFn: (key: string) => string,
	templates: readonly TemplateSchema.Type[] | undefined,
) => {
	const rules = outcome.rules.length;
	const ruleSummary = rules === 0 ? "" : ` · ${rules} ${textFn(rules === 1 ? "rule" : "rules")}`;
	if (outcome.type === "space")
		return `${readSpaceDestinationLabelFn(outcome.space, textFn, templates)}${ruleSummary}`;
	if (outcome.type === "template") return `${textFn("Template")}${ruleSummary}`;
	const { min, max } = outcome.quantity;
	const quantity = min === max ? `×${min}` : `×${min}–${max}`;
	const placement = textFn(outcome.placement === "drop" ? "Local drop" : "Random");
	return `${quantity} · ${placement}${ruleSummary}`;
};
const RollTypeLabelByType = {
	chance: "Chance",
	guaranteed: "Guaranteed",
} as const satisfies Record<RollSchema.Type["type"], string>;

const OutcomeFields = ({
	initialRuleIndex,
	initialWhenIndex,
	onChangeFn,
	value,
}: {
	readonly onChangeFn: (outcome: OutcomeSchema.Type) => void;
	readonly initialRuleIndex?: number;
	readonly initialWhenIndex?: number;
	readonly value: OutcomeSchema.Type;
}) => {
	const project = useEditorProject();
	const validationIssues = useFormValidationIssues(value);
	const translator = useTranslator();
	return (
		<div className="grid gap-3">
			{value.type === "template" ? (
				<TemplateSelector
					templates={project.config.templates ?? []}
					value={value.templateUid}
					error={readEditorFormValidationErrorFn(validationIssues, "templateUid")}
					onChangeFn={(templateUid) =>
						onChangeFn({
							...value,
							templateUid,
						})
					}
				/>
			) : null}
			{match(value)
				.with(
					{
						type: "item",
					},
					(value) => (
						<>
							<EditorItemReferenceControl
								error={readEditorFormValidationErrorFn(validationIssues, "itemUid")}
								label={translator.textFn("Item")}
								value={value.itemUid}
								onChangeFn={(itemUid) =>
									onChangeFn({
										...value,
										itemUid,
									})
								}
							/>
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
						</>
					),
				)
				.with(
					{
						type: "space",
					},
					(value) =>
						value.space === "previous" ? null : (
							<SpaceDestinationControl
								kindEditable={false}
								error={readEditorFormValidationErrorFn(validationIssues, "space")}
								value={value.space}
								onChangeFn={(space) =>
									onChangeFn({
										...value,
										space,
									})
								}
								trailing={
									<LinkButton
										className="whitespace-nowrap"
										onClick={() =>
											onChangeFn({
												...value,
												space: Math.floor(Math.random() * 897) + 128,
											})
										}
									>
										{translator.textFn("Pick random space")}
									</LinkButton>
								}
							/>
						),
				)
				.with(
					{
						type: "template",
					},
					() => null,
				)
				.exhaustive()}
			<SectionEnd />
			<RulesControl
				initialRuleIndex={initialRuleIndex}
				initialWhenIndex={initialWhenIndex}
				rules={value.rules}
				target="outcome"
				description={<Mx label="Outcome rules help" />}
				allowedTypes={[
					"enable",
					"disable",
				]}
				onChangeFn={(rules) =>
					onChangeFn({
						...value,
						rules: rules as OutcomeSchema.Type["rules"],
					})
				}
			/>
		</div>
	);
};

const OutcomeList = ({
	initialRuleIndex,
	initialWhenIndex,
	initialOutcomeIndex,
	onChangeFn,
	value,
}: {
	readonly initialOutcomeIndex?: number;
	readonly onChangeFn: (outcomes: OutcomeListValue) => void;
	readonly initialRuleIndex?: number;
	readonly initialWhenIndex?: number;
	readonly value: OutcomeListValue;
}) => {
	const readItemLabelFn = useEditorItemOptionLabel();
	const project = useEditorProject();
	const items = project.config?.items ?? {};
	const translator = useTranslator();
	const validationIssues = useFormValidationIssues(value);
	const invalidOutcomeIndex = useFormValidationFocusIndex(value as object);
	return (
		<section className="grid gap-3">
			<EditorFormSectionDivider
				description={<Mx label="Outcomes help" />}
				title={translator.textFn("Outcomes")}
				variant="secondary"
			/>
			<EditorCollectionSelector
				dataUi="EditorOutcomesCollection"
				count={value.length}
				error={readRequiredEditorCollectionErrorFn(
					validationIssues,
					value.length,
					1,
					translator.textFn("Add at least one outcome."),
				)}
				initialSelectedIndex={initialOutcomeIndex}
				key={initialOutcomeIndex}
				itemLabelFn={(index) => {
					const outcome = value[index];
					const label = match(outcome)
						.with(
							{
								type: "item",
							},
							({ itemUid }) =>
								readItemLabelFn(itemUid, translator.textFn("No item selected")),
						)
						.with(
							{
								type: "template",
							},
							({ templateUid }) =>
								project.config.templates?.find(
									(template) => template.uid === templateUid,
								)?.title ?? translator.textFn("No template selected"),
						)
						.with(
							{
								type: "space",
							},
							({ space }) =>
								readSpaceDestinationLabelFn(
									space,
									translator.textFn,
									project.config.templates,
								),
						)
						.exhaustive();
					return `${translator.textFn("Outcome")} ${index + 1} — ${label}`;
				}}
				itemSearchTermsFn={(index) => [
					match(value[index])
						.with(
							{
								type: "item",
							},
							({ itemUid }) => itemUid,
						)
						.with(
							{
								type: "template",
							},
							({ templateUid }) => templateUid,
						)
						.with(
							{
								type: "space",
							},
							({ space }) =>
								readSpaceDestinationLabelFn(
									space,
									translator.textFn,
									project.config.templates,
								),
						)
						.exhaustive(),
				]}
				label={translator.textFn("Outcomes")}
				itemMetaFn={(index) =>
					readOutcomeSummaryFn(value[index], translator.textFn, project.config.templates)
				}
				renderItemContentFn={(index, label) => (
					<OutcomeOption
						label={label}
						outcomes={[
							value[index],
						]}
						summary={readOutcomeSummaryFn(
							value[index],
							translator.textFn,
							project.config.templates,
						)}
					/>
				)}
				renderSelectedItemPreviewFn={(index) => (
					<EditorItemSearchThumbnail
						item={
							index === undefined
								? undefined
								: match(value[index])
										.with(
											{
												type: "item",
											},
											({ itemUid }) => items[itemUid],
										)
										.with(
											{
												type: "template",
											},
											{
												type: "space",
											},
											() => undefined,
										)
										.exhaustive()
						}
						selected
					/>
				)}
				addOptions={[
					{
						id: "drop-local",
						label: translator.textFn("Drop - Local"),
						description: translator.textFn(
							"Place items in nearby empty cells beside the producer.",
						),
						icon: <MapPin className="size-5" />,
						onSelectFn: () =>
							onChangeFn([
								...value,
								structuredClone(DraftDefaults.itemOutcome),
							]),
					},
					{
						id: "drop-random",
						label: translator.textFn("Drop - Random"),
						description: translator.textFn(
							"Place items near random cells on the current Board.",
						),
						icon: <Shuffle className="size-5" />,
						onSelectFn: () =>
							onChangeFn([
								...value,
								{
									...structuredClone(DraftDefaults.itemOutcome),
									placement: "random",
								},
							]),
					},
					{
						id: "space",
						label: translator.textFn("Space"),
						description: translator.textFn("Move to an exact space number."),
						icon: <DoorOpen className="size-5" />,
						onSelectFn: () =>
							onChangeFn([
								...value,
								{
									type: "space",
									space: 0,
									rules: [],
								},
							]),
					},
					{
						id: "space-previous",
						label: translator.textFn("Previous Space"),
						description: translator.textFn(
							"Return to the last space left. Without history, this outcome does nothing.",
						),
						icon: <History className="size-5" />,
						onSelectFn: () =>
							onChangeFn([
								...value,
								{
									type: "space",
									space: "previous",
									rules: [],
								},
							]),
					},
					{
						id: "space-inventory",
						label: translator.textFn("Inventory"),
						description: translator.textFn(
							"Open this item's Inventory, an item-owned Space initialized from a template on first use.",
						),
						icon: <Sparkles className="size-5" />,
						onSelectFn: () =>
							onChangeFn([
								...value,
								{
									type: "space",
									space: {
										type: "inventory",
										templateUid: project.config.templates?.[0]?.uid ?? "",
									},
									rules: [],
								},
							]),
					},
					{
						id: "template",
						label: translator.textFn("Template"),
						description: translator.textFn(
							"Replaces the producer's space with this template, removing its items and active production.",
						),
						icon: <PanelsTopLeft className="size-5" />,
						onSelectFn: () =>
							onChangeFn([
								...value,
								{
									type: "template",
									templateUid: "",
									rules: [],
								},
							]),
					},
				]}
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
				selectedIndex={invalidOutcomeIndex}
			>
				{(index) => (
					<OutcomeFields
						initialRuleIndex={
							index === initialOutcomeIndex ? initialRuleIndex : undefined
						}
						initialWhenIndex={
							index === initialOutcomeIndex ? initialWhenIndex : undefined
						}
						value={value[index]}
						onChangeFn={(next) =>
							onChangeFn(
								value.map((current, currentIndex) =>
									currentIndex === index ? next : current,
								) as OutcomeListValue,
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
	initialOutcomeIndex,
	onChangeFn,
	value,
}: {
	readonly initialOutcomeIndex?: number;
	readonly onChangeFn: (roll: RollSchema.Type) => void;
	readonly initialRuleIndex?: number;
	readonly initialWhenIndex?: number;
	readonly value: DraftRoll;
}) => {
	const validationIssues = useFormValidationIssues(value);
	const translator = useTranslator();
	return (
		<div className="grid gap-4">
			{value.type === undefined
				? null
				: match(value as RollSchema.Type)
						.with(
							{
								type: "guaranteed",
							},
							(roll) => (
								<OutcomeList
									initialRuleIndex={initialRuleIndex}
									initialWhenIndex={initialWhenIndex}
									value={roll.outcome}
									initialOutcomeIndex={initialOutcomeIndex}
									onChangeFn={(outcome) =>
										onChangeFn({
											...roll,
											outcome: outcome as typeof roll.outcome,
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
									<OutcomeList
										initialRuleIndex={initialRuleIndex}
										initialWhenIndex={initialWhenIndex}
										value={roll.outcome}
										initialOutcomeIndex={initialOutcomeIndex}
										onChangeFn={(outcome) =>
											onChangeFn({
												...roll,
												outcome: outcome as typeof roll.outcome,
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
	initialOutcomeIndex,
	onChangeFn,
	value,
}: {
	readonly index: number;
	readonly showWeight: boolean;
	readonly initialRollIndex?: number;
	readonly initialOutcomeIndex?: number;
	readonly onChangeFn: (set: RollSetSchema.Type) => void;
	readonly initialRuleIndex?: number;
	readonly initialWhenIndex?: number;
	readonly value: RollSetSchema.Type;
}) => {
	const readItemLabelFn = useEditorItemOptionLabel();
	const project = useEditorProject();
	const translator = useTranslator();
	const validationIssues = useFormValidationIssues(value);
	const invalidRollIndex = useFormValidationFocusIndex(value, "roll");
	return (
		<section className="grid gap-3">
			{showWeight ? (
				<EditorNumberControl
					description={<Mx label="Outcome set weight help" />}
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
				description={<Mx label="Outcome set rules help" />}
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
					const { label } = readOutcomeCollectionSummaryFn({
						outcomes: readDraftRollOutcomesFn(roll),
						templates: project.config.templates,
						readItemLabelFn,
						textFn: translator.textFn,
					});
					return `${translator.textFn(roll.type === undefined ? "Roll" : RollTypeLabelByType[roll.type])} ${rollIndex + 1} — ${label || translator.textFn("No outcome configured.")}`;
				}}
				itemSearchTermsFn={(rollIndex) =>
					readOutcomeCollectionSummaryFn({
						outcomes: readDraftRollOutcomesFn(value.roll[rollIndex]),
						templates: project.config.templates,
						readItemLabelFn,
						textFn: translator.textFn,
					}).searchTerms
				}
				renderItemContentFn={(rollIndex, label) => (
					<OutcomeOption
						label={label}
						outcomes={readDraftRollOutcomesFn(value.roll[rollIndex])}
					/>
				)}
				label={`${translator.textFn("Outcome set")} ${index + 1} ${translator.textFn("rolls")}`}
				addOptions={[
					{
						id: "guaranteed",
						label: translator.textFn("Guaranteed"),
						description: translator.textFn("Always produce this roll's outcomes."),
						icon: <CircleCheck className="size-5" />,
						onSelectFn: () =>
							onChangeFn({
								...value,
								roll: [
									...value.roll,
									structuredClone(DraftDefaults.rolls.guaranteed),
								],
							}),
					},
					{
						id: "chance",
						label: translator.textFn("Chance"),
						description: translator.textFn(
							"Produce this roll's outcomes with a chosen chance.",
						),
						icon: <Dice5 className="size-5" />,
						onSelectFn: () =>
							onChangeFn({
								...value,
								roll: [
									...value.roll,
									structuredClone(DraftDefaults.rolls.chance),
								],
							}),
					},
				]}
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
						initialOutcomeIndex={
							rollIndex === initialRollIndex ? initialOutcomeIndex : undefined
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
