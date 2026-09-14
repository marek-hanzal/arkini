import { match } from "ts-pattern";

import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";
import { QuantityControl, QuantityFields } from "~/production-authoring/ui/QuantityControl";
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
import { EditorFormBranchEnd } from "~/editor-control/ui/EditorFormBranchEnd";
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

type DropListValue = DropSchema.Type[];
type WeightedRoll = Extract<
	RollSchema.Type,
	{
		readonly type: "weight";
	}
>;

const readChancePercentFn = (chance: number) => Number((chance * 100).toFixed(6));
const readDropSummaryFn = (drop: DropSchema.Type) => {
	const { min, max } = drop.quantity;
	const quantity = min === max ? `×${min}` : `×${min}–${max}`;
	const placement = drop.placement === "drop" ? "Local drop" : "Random";
	const rules = drop.rules.length;
	return `${quantity} · ${placement}${rules === 0 ? "" : ` · ${rules} ${rules === 1 ? "rule" : "rules"}`}`;
};
const RollTypeLabelByType = {
	chance: "Chance",
	guaranteed: "Guaranteed",
	weight: "Weighted",
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
	return (
		<div className="grid gap-3">
			<EditorItemReferenceControl
				error={readEditorFormValidationErrorFn(validationIssues, "itemId")}
				label="Dropped item"
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
					label="Board placement"
					value={value.placement}
					options={[
						{
							description: <Mx label="Local drop placement help" />,
							label: "Local drop",
							value: "drop",
						},
						{
							description: <Mx label="Random drop placement help" />,
							label: "Random",
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
			<EditorFormBranchEnd />
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
	const validationIssues = useFormValidationIssues(value);
	const invalidDropIndex = useFormValidationFocusIndex(value as object);
	return (
		<section className="grid gap-3">
			<EditorFormSectionDivider
				description={<Mx label="Drops help" />}
				title="Drops"
				variant="secondary"
			/>
			<EditorCollectionSelector
				addLabel="Add drop"
				count={value.length}
				error={readRequiredEditorCollectionErrorFn(
					validationIssues,
					value.length,
					1,
					"Add at least one drop.",
				)}
				initialSelectedIndex={initialDropIndex}
				key={initialDropIndex}
				itemLabelFn={(index) =>
					`Drop ${index + 1} — ${readItemLabelFn(
						value[index].itemId,
						"No item selected",
					)}`
				}
				itemSearchTermsFn={(index) => [
					value[index].itemId,
				]}
				label="Drops"
				itemMetaFn={(index) => readDropSummaryFn(value[index])}
				renderItemContentFn={(index, label) => (
					<OutputDropOption
						label={label}
						drops={[
							value[index],
						]}
						summary={readDropSummaryFn(value[index])}
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
				onRemoveFn={(index) =>
					onChangeFn(value.filter((_current, currentIndex) => currentIndex !== index))
				}
				removeLabel="Remove drop"
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

const WeightedRollControl = ({
	initialRuleIndex,
	initialWhenIndex,
	initialDropIndex,
	initialCandidateIndex,
	onChangeFn,
	roll,
}: {
	readonly initialDropIndex?: number;
	readonly initialCandidateIndex?: number;
	readonly onChangeFn: (roll: RollSchema.Type) => void;
	readonly initialRuleIndex?: number;
	readonly initialWhenIndex?: number;
	readonly roll: WeightedRoll;
}) => {
	const readItemLabelFn = useEditorItemOptionLabel();
	const validationIssues = useFormValidationIssues(roll);
	const invalidCandidateIndex = useFormValidationFocusIndex(roll, "drop");
	return (
		<div className="grid gap-4">
			<div className="grid gap-3">
				<EditorFormSectionDivider
					description={<Mx label="Weighted selections help" />}
					title="Selections"
					variant="secondary"
				/>
				<div className="grid gap-3 sm:grid-cols-2">
					<QuantityFields
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
						value={roll.quantity}
						onChangeFn={(quantity) =>
							onChangeFn({
								...roll,
								quantity,
							})
						}
					/>
				</div>
			</div>
			<EditorFormSectionDivider
				description={<Mx label="Weighted candidates help" />}
				title="Weighted candidates"
				variant="secondary"
			/>
			<EditorCollectionSelector
				addLabel="Add weighted candidate"
				count={roll.drop.length}
				error={readRequiredEditorCollectionErrorFn(
					validationIssues,
					roll.drop.length,
					2,
					"Add at least two weighted candidates.",
					"drop",
				)}
				initialSelectedIndex={initialCandidateIndex}
				key={initialCandidateIndex}
				itemLabelFn={(candidateIndex) => {
					const itemId = roll.drop[candidateIndex].drop[0]?.itemId;
					return `Candidate ${candidateIndex + 1} — ${readItemLabelFn(
						itemId ?? "",
						"No item selected",
					)}`;
				}}
				itemSearchTermsFn={(candidateIndex) =>
					roll.drop[candidateIndex].drop.flatMap((drop) => [
						drop.itemId,
						readItemLabelFn(drop.itemId, ""),
					])
				}
				renderItemContentFn={(candidateIndex, label) => {
					const candidate = roll.drop[candidateIndex];
					const summary = [
						`Weight ${candidate.weight}`,
						...candidate.drop.map((drop) =>
							candidate.drop.length === 1
								? readDropSummaryFn(drop)
								: `${readItemLabelFn(drop.itemId, "No item selected")}: ${readDropSummaryFn(drop)}`,
						),
					].join(" · ");
					return (
						<OutputDropOption
							label={label}
							drops={candidate.drop}
							summary={summary}
						/>
					);
				}}
				label="Weighted candidates"
				onAddFn={() =>
					onChangeFn({
						...roll,
						drop: [
							...roll.drop,
							{
								weight: 1,
								drop: [
									structuredClone(DraftDefaults.drop),
								],
							},
						],
					})
				}
				onRemoveFn={(candidateIndex) =>
					onChangeFn({
						...roll,
						drop: roll.drop.filter(
							(_current, currentIndex) => currentIndex !== candidateIndex,
						) as typeof roll.drop,
					})
				}
				removeLabel="Remove weighted candidate"
				selectedIndex={invalidCandidateIndex}
			>
				{(candidateIndex) => {
					const candidate = roll.drop[candidateIndex];
					return (
						<div className="grid gap-3">
							<EditorNumberControl
								description={<Mx label="Weighted candidate weight help" />}
								error={readEditorFormValidationErrorFn(
									validationIssues,
									"drop",
									candidateIndex,
									"weight",
								)}
								label={`Candidate ${candidateIndex + 1} weight`}
								value={candidate.weight}
								min={1}
								onChangeFn={(weight) =>
									onChangeFn({
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
							<DropList
								initialRuleIndex={
									candidateIndex === initialCandidateIndex
										? initialRuleIndex
										: undefined
								}
								initialWhenIndex={
									candidateIndex === initialCandidateIndex
										? initialWhenIndex
										: undefined
								}
								value={candidate.drop}
								initialDropIndex={
									candidateIndex === initialCandidateIndex
										? initialDropIndex
										: undefined
								}
								onChangeFn={(drop) =>
									onChangeFn({
										...roll,
										drop: roll.drop.map((current, currentIndex) =>
											currentIndex === candidateIndex
												? {
														...current,
														drop: drop as typeof current.drop,
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

const RollControl = ({
	initialRuleIndex,
	initialWhenIndex,
	initialDropIndex,
	initialCandidateIndex,
	onChangeFn,
	value,
}: {
	readonly initialDropIndex?: number;
	readonly initialCandidateIndex?: number;
	readonly onChangeFn: (roll: RollSchema.Type) => void;
	readonly initialRuleIndex?: number;
	readonly initialWhenIndex?: number;
	readonly value: DraftRoll;
}) => {
	const validationIssues = useFormValidationIssues(value);
	return (
		<div className="grid gap-4">
			<EditorChoiceControl
				error={readEditorFormValidationErrorFn(validationIssues, "type")}
				label="Roll type"
				value={value.type}
				options={[
					{
						description: <Mx label="Guaranteed roll type help" />,
						label: "Guaranteed",
						value: "guaranteed",
					},
					{
						description: <Mx label="Chance roll type help" />,
						label: "Chance",
						value: "chance",
					},
					{
						description: <Mx label="Weighted roll type help" />,
						label: "Weighted",
						value: "weight",
					},
				]}
				onChangeFn={(type) => onChangeFn(structuredClone(DraftDefaults.rolls[type]))}
			/>
			{value.type === undefined
				? null
				: match(value as RollSchema.Type)
						.with(
							{
								type: "guaranteed",
							},
							(roll) => (
								<div className="grid gap-3">
									<EditorFormBranchEnd />
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
										label="Chance (%)"
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
						.with(
							{
								type: "weight",
							},
							(roll) => (
								<WeightedRollControl
									initialRuleIndex={initialRuleIndex}
									initialWhenIndex={initialWhenIndex}
									roll={roll}
									initialDropIndex={initialDropIndex}
									initialCandidateIndex={initialCandidateIndex}
									onChangeFn={onChangeFn}
								/>
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
	initialRollIndex,
	initialDropIndex,
	initialCandidateIndex,
	onChangeFn,
	value,
}: {
	readonly index: number;
	readonly initialRollIndex?: number;
	readonly initialDropIndex?: number;
	readonly initialCandidateIndex?: number;
	readonly onChangeFn: (set: RollSetSchema.Type) => void;
	readonly initialRuleIndex?: number;
	readonly initialWhenIndex?: number;
	readonly value: RollSetSchema.Type;
}) => {
	const readItemLabelFn = useEditorItemOptionLabel();
	const validationIssues = useFormValidationIssues(value);
	const invalidRollIndex = useFormValidationFocusIndex(value, "roll");
	return (
		<section className="grid gap-3">
			<EditorNumberControl
				description={<Mx label="Output set weight help" />}
				error={readEditorFormValidationErrorFn(validationIssues, "weight")}
				label="Relative set weight"
				value={value.weight}
				min={1}
				onChangeFn={(weight) =>
					onChangeFn({
						...value,
						weight,
					})
				}
			/>
			<EditorFormSectionDivider
				description={<Mx label="Rolls help" />}
				required
				title="Rolls"
				variant="secondary"
			/>
			<EditorCollectionSelector
				addLabel="Add roll"
				count={value.roll.length}
				error={readRequiredEditorCollectionErrorFn(
					validationIssues,
					value.roll.length,
					1,
					"Add at least one roll.",
					"roll",
				)}
				initialSelectedIndex={initialRollIndex}
				key={initialRollIndex}
				itemLabelFn={(rollIndex) => {
					const roll = value.roll[rollIndex];
					return `${roll.type === undefined ? "Roll" : RollTypeLabelByType[roll.type]} ${rollIndex + 1} — ${readItemLabelFn(
						readDraftRollDropsFn(roll)[0]?.itemId ?? "",
						"No item selected",
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
				label={`Output set ${index + 1} rolls`}
				onAddFn={() =>
					onChangeFn({
						...value,
						roll: [
							...value.roll,
							structuredClone(DraftDefaults.roll),
						],
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
				removeLabel="Remove roll"
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
						initialCandidateIndex={
							rollIndex === initialRollIndex ? initialCandidateIndex : undefined
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
