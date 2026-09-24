import { readOutcomeCollectionSummaryFn } from "~/production-authoring/fn/readOutcomeCollectionSummaryFn";
import { TemplateSelector } from "~/template-authoring/ui/TemplateSelector";
import {
	CircleCheck,
	Dice5,
	Package,
	DoorOpen,
	MapPin,
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
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { OutcomeOption } from "~/production-authoring/ui/OutcomeOption";
import {
	readDraftRollOutcomesFn,
	type DraftRoll,
} from "~/production-authoring/fn/readDraftRollOutcomesFn";
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

type OutcomeListValue = OutcomeSchema.Type[];
const readChancePercentFn = (chance: number) => Number((chance * 100).toFixed(6));
const readOutcomeSummaryFn = (outcome: OutcomeSchema.Type, textFn: (key: string) => string) => {
	const rules = outcome.rules.length;
	const ruleSummary = rules === 0 ? "" : ` · ${rules} ${textFn(rules === 1 ? "rule" : "rules")}`;
	if (outcome.type === "space") return `${textFn("Space")} ${outcome.space}${ruleSummary}`;
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
			<div className="grid grid-cols-2 items-end gap-3">
				<EditorChoiceControl
					label={translator.textFn("Outcome type")}
					value={value.type}
					options={[
						{
							value: "item",
							icon: <Package className="size-4 shrink-0" />,
							label: translator.textFn("Item"),
						},
						{
							value: "space",
							icon: <DoorOpen className="size-4 shrink-0" />,
							label: translator.textFn("Space"),
						},
						{
							value: "template",
							icon: <PanelsTopLeft className="size-4 shrink-0" />,
							label: translator.textFn("Template"),
							description: translator.textFn(
								"Replaces the producer's space with this template, removing its items and active production.",
							),
						},
					]}
					onChangeFn={(type) => {
						if (type === value.type) return;
						onChangeFn(
							match(type)
								.with("item", () => ({
									...structuredClone(DraftDefaults.itemOutcome),
									rules: value.rules,
								}))
								.with("template", () => ({
									type: "template" as const,
									templateUid: "",
									rules: value.rules,
								}))
								.with("space", () => ({
									type: "space" as const,
									space: 0,
									rules: value.rules,
								}))
								.exhaustive(),
						);
					}}
				/>
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
			</div>
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
							<div className="flex flex-wrap items-end justify-between gap-3">
								<div className="min-w-0 basis-1/2">
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
									error={readEditorFormValidationErrorFn(
										validationIssues,
										"placement",
									)}
									label={translator.textFn("Board placement")}
									value={value.placement}
									options={[
										{
											description: <Mx label="Local drop placement help" />,
											label: translator.textFn("Local drop"),
											icon: <MapPin className="size-4" />,
											value: "drop",
										},
										{
											description: <Mx label="Random drop placement help" />,
											label: translator.textFn("Random"),
											icon: <Shuffle className="size-4" />,
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
						</>
					),
				)
				.with(
					{
						type: "space",
					},
					(value) => (
						<EditorNumberControl
							error={readEditorFormValidationErrorFn(validationIssues, "space")}
							description={<Mx label="Target space help" />}
							label={translator.textFn("Target space")}
							min={0}
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
							({ space }) => `${translator.textFn("Space")} ${space}`,
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
							({ space }) => `${translator.textFn("Space")} ${space}`,
						)
						.exhaustive(),
				]}
				label={translator.textFn("Outcomes")}
				itemMetaFn={(index) => readOutcomeSummaryFn(value[index], translator.textFn)}
				renderItemContentFn={(index, label) => (
					<OutcomeOption
						label={label}
						outcomes={[
							value[index],
						]}
						summary={readOutcomeSummaryFn(value[index], translator.textFn)}
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
				onAddFn={() =>
					onChangeFn([
						...value,
						structuredClone(DraftDefaults.itemOutcome),
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
			<div className="flex min-w-0 justify-end">
				<EditorChoiceControl
					error={readEditorFormValidationErrorFn(validationIssues, "type")}
					label={translator.textFn("Roll type")}
					value={value.type}
					options={[
						{
							description: <Mx label="Guaranteed roll type help" />,
							label: translator.textFn("Guaranteed"),
							icon: <CircleCheck className="size-4" />,
							value: "guaranteed",
						},
						{
							description: <Mx label="Chance roll type help" />,
							label: translator.textFn("Chance"),
							icon: <Dice5 className="size-4" />,
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
