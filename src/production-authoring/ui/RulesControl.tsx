import {
	CircleCheck,
	CircleOff,
	Eye,
	EyeOff,
	Timer,
	Gauge,
	SearchCheck,
	Hash,
	MoveHorizontal,
} from "lucide-react";
import { match } from "ts-pattern";

import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import type { RuleSchema as ActionRuleSchema } from "~/production-action/schema/RuleSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";
import type { RuleSchema as LineRuleSchema } from "~/production-line/schema/RuleSchema";
import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";
import { BoardDistanceControl } from "~/production-authoring/ui/BoardDistanceControl";
import { SelectorControl } from "~/production-authoring/ui/SelectorControl";
import type { OutcomeRuleSchema } from "~/outcome/schema/OutcomeRuleSchema";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { SectionEnd } from "~/ui/ui/SectionEnd";
import { BoardDistancePresentation } from "~/item-query/ui/QueryPresentation";
import {
	EditorNumberControl,
	EditorSecondsControl,
	EditorTextControl,
} from "~/editor-control/ui/EditorValueControls";
import {
	useFormValidationFocusIndex,
	useFormValidationIssues,
} from "~/item-authoring/ui/useFormValidationIssues";
import { readEditorFormValidationErrorFn } from "~/editor-control/fn/readEditorFormValidationErrorFn";
import { readRequiredEditorCollectionErrorFn } from "~/editor-control/fn/readRequiredEditorCollectionErrorFn";
import { useTranslator } from "~/translation/ui/useTranslator";
import type { ReactNode } from "react";
import type { ActionMenuOption } from "~/ui/ui/ActionMenu";
import { QuantityFields } from "~/production-authoring/ui/QuantityControl";
import { EditorCollectionOption } from "~/editor-control/ui/EditorCollectionOption";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useEditorItemOptionLabel } from "~/authoring-form/ui/useEditorItemSearchOptions";

type RuleValue = ActionRuleSchema.Type | LineRuleSchema.Type | OutcomeRuleSchema.Type;
type RuleType = LineRuleSchema.Type["type"];
type RuleTarget = "action" | "set" | "outcome" | "line";
type DraftWhen =
	| WhenSchema.Type
	| {
			readonly query: QuerySchema.Type;
			readonly type?: undefined;
	  };
type RuleWithDraftConditions<Value> = Value extends RuleValue
	? Omit<Value, "when"> & {
			readonly when: DraftWhen[];
		}
	: never;
type DraftRule =
	| RuleWithDraftConditions<RuleValue>
	| {
			readonly hint?: string;
			readonly type?: undefined;
			readonly when: DraftWhen[];
	  };

const RuleTypeIcon = {
	enable: <CircleCheck className="size-4 shrink-0" />,
	disable: <CircleOff className="size-4 shrink-0" />,
	show: <Eye className="size-4 shrink-0" />,
	hide: <EyeOff className="size-4 shrink-0" />,
	"runtime:adjust": <Timer className="size-4 shrink-0" />,
	"runtime:multiplier": <Gauge className="size-4 shrink-0" />,
} satisfies Record<RuleType, ReactNode>;

const RuleTypeTranslationKey = {
	disable: "Disable",
	enable: "Enable",
	hide: "Hide",
	"runtime:adjust": "Runtime adjustment",
	"runtime:multiplier": "Runtime multiplier",
	show: "Show",
} as const satisfies Record<RuleType, string>;

const RuleTypeDescriptionKey = {
	disable: "Disable this when its conditions match.",
	enable: "Enable this when its conditions match.",
	hide: "Hide this production line when its conditions match.",
	"runtime:adjust": "Adjust this production line's running time.",
	"runtime:multiplier": "Multiply this production line's running time.",
	show: "Show this production line when its conditions match.",
} as const satisfies Record<RuleType, string>;

const readConditionItemUidFn = (when: DraftWhen): string => when.query.selector.itemUid;

const readRuleItemUidsFn = (rule: DraftRule): ReadonlyArray<string> => [
	...new Set(
		rule.when
			.map((when) => readConditionItemUidFn(when))
			.filter((itemUid) => itemUid.length > 0),
	),
];

const readRuleSummaryFn = (rule: DraftRule, textFn: (key: string) => string): string => {
	const conditionSummary = `${rule.when.length} ${textFn(rule.when.length === 1 ? "condition" : "conditions")}`;
	if (rule.type === "runtime:multiplier") return `×${rule.multiplier} · ${conditionSummary}`;
	if (rule.type === "runtime:adjust") return `${rule.adjustMs / 1_000}s · ${conditionSummary}`;
	return conditionSummary;
};

const RuleOption = ({ label, rule }: { readonly label: string; readonly rule: DraftRule }) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const itemUids = readRuleItemUidsFn(rule);
	return (
		<EditorCollectionOption
			label={label}
			details={
				<span className="text-xs text-subtle">
					{readRuleSummaryFn(rule, translator.textFn)}
				</span>
			}
		>
			{itemUids.map((itemUid) => (
				<EditorItemThumbnail
					key={itemUid}
					className="rounded-md"
					resourceUids={
						project.config.items[itemUid]?.artwork.default ?? [
							"",
						]
					}
					size="md"
				/>
			))}
		</EditorCollectionOption>
	);
};

const readConditionSummaryFn = (when: DraftWhen, textFn: (key: string) => string): string => {
	const querySummary = textFn(BoardDistancePresentation[when.query.distance].label);
	if (when.type === "count") return `${querySummary} · = ${when.count}`;
	if (when.type === "range") return `${querySummary} · ${when.min}–${when.max}`;
	return querySummary;
};

const ConditionOption = ({ label, when }: { readonly label: string; readonly when: DraftWhen }) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const itemUid = readConditionItemUidFn(when);
	return (
		<EditorCollectionOption
			label={label}
			details={
				<span className="text-xs text-subtle">
					{readConditionSummaryFn(when, translator.textFn)}
				</span>
			}
		>
			{itemUid.length === 0 ? null : (
				<EditorItemThumbnail
					className="rounded-md"
					resourceUids={
						project.config.items[itemUid]?.artwork.default ?? [
							"",
						]
					}
					size="md"
				/>
			)}
		</EditorCollectionOption>
	);
};

const WhenControl = ({
	onChangeFn,
	showBranchEnd,
	value,
}: {
	readonly onChangeFn: (when: DraftWhen) => void;
	readonly showBranchEnd: boolean;
	readonly value: DraftWhen;
}) => {
	const validationIssues = useFormValidationIssues(value);
	const translator = useTranslator();
	const selectedValue = value.type === undefined ? undefined : value;
	return (
		<div className="grid min-w-0 gap-3">
			{selectedValue === undefined ? null : (
				<>
					<div className="grid min-w-0 grid-cols-2 items-start gap-3">
						<SelectorControl
							error={readEditorFormValidationErrorFn(
								validationIssues,
								"query",
								"selector",
							)}
							value={selectedValue.query.selector}
							onChangeFn={(selector) =>
								onChangeFn({
									...selectedValue,
									query: {
										...selectedValue.query,
										selector,
									},
								})
							}
						/>
						<div className="flex min-w-0 justify-end">
							<BoardDistanceControl
								error={readEditorFormValidationErrorFn(
									validationIssues,
									"query",
									"distance",
								)}
								value={selectedValue.query}
								onChangeFn={(query) =>
									onChangeFn({
										...selectedValue,
										query,
									})
								}
							/>
						</div>
					</div>
					{match(selectedValue)
						.with(
							{
								type: "exists",
							},
							() => null,
						)
						.with(
							{
								type: "count",
							},
							(when) => (
								<EditorNumberControl
									error={readEditorFormValidationErrorFn(
										validationIssues,
										"count",
									)}
									label={translator.textFn("Exact count")}
									value={when.count}
									min={0}
									onChangeFn={(count) =>
										onChangeFn({
											...when,
											count,
										})
									}
								/>
							),
						)
						.with(
							{
								type: "range",
							},
							(when) => (
								<div className="grid grid-cols-2 gap-3">
									<QuantityFields
										minimumError={readEditorFormValidationErrorFn(
											validationIssues,
											"min",
										)}
										maximumError={readEditorFormValidationErrorFn(
											validationIssues,
											"max",
										)}
										minimumLabel={translator.textFn("Minimum count")}
										maximumLabel={translator.textFn("Maximum count")}
										minimumValue={0}
										value={when}
										onChangeFn={(range) =>
											onChangeFn({
												...when,
												...range,
											})
										}
									/>
								</div>
							),
						)
						.exhaustive()}
					{showBranchEnd && <SectionEnd />}
				</>
			)}
		</div>
	);
};

const RuleControl = ({
	initialWhenIndex,
	onChangeFn,
	rule,
	ruleIndex,
	ruleTarget,
}: {
	readonly onChangeFn: (rule: DraftRule) => void;
	readonly initialWhenIndex?: number;
	readonly rule: DraftRule;
	readonly ruleIndex: number;
	readonly ruleTarget: RuleTarget;
}) => {
	const validationIssues = useFormValidationIssues(rule);
	const invalidWhenIndex = useFormValidationFocusIndex(rule, "when");
	const readItemLabelFn = useEditorItemOptionLabel();
	const translator = useTranslator();
	return (
		<article className="grid gap-3">
			{rule.type === undefined ? null : (
				<>
					<EditorTextControl
						error={readEditorFormValidationErrorFn(validationIssues, "hint")}
						label={translator.textFn("Hint")}
						placeholder={translator.textFn(
							"Optional explanation shown while this rule applies",
						)}
						required={false}
						value={rule.hint ?? ""}
						onChangeFn={(hint) =>
							onChangeFn({
								...rule,
								...(hint.trim() === ""
									? {
											hint: undefined,
										}
									: {
											hint,
										}),
							})
						}
					/>
					{rule.type !== "runtime:multiplier" ? null : (
						<EditorNumberControl
							error={readEditorFormValidationErrorFn(validationIssues, "multiplier")}
							label={translator.textFn("Runtime multiplier")}
							value={rule.multiplier}
							min={0.01}
							step={0.01}
							onChangeFn={(multiplier) =>
								onChangeFn({
									...rule,
									multiplier,
								})
							}
						/>
					)}
					{rule.type !== "runtime:adjust" ? null : (
						<EditorSecondsControl
							error={readEditorFormValidationErrorFn(validationIssues, "adjustMs")}
							label={translator.textFn("Runtime adjustment (seconds)")}
							step={5}
							value={rule.adjustMs / 1_000}
							onChangeFn={(adjustSeconds) =>
								onChangeFn({
									...rule,
									adjustMs: Math.round(adjustSeconds * 1_000),
								})
							}
						/>
					)}
					<EditorCollectionSelector
						dataUi="EditorConditionsCollection"
						initialSelectedIndex={initialWhenIndex}
						key={initialWhenIndex}
						count={rule.when.length}
						error={readRequiredEditorCollectionErrorFn(
							validationIssues,
							rule.when.length,
							1,
							translator.textFn("Add at least one condition."),
							"when",
						)}
						itemLabelFn={(whenIndex) =>
							rule.when[whenIndex].type === undefined
								? `${translator.textFn("Condition")} ${whenIndex + 1}`
								: `${translator.textFn("Condition")} ${whenIndex + 1} — ${translator.textFn(
										match(rule.when[whenIndex].type)
											.with("count", () => "Exact count")
											.with("range", () => "Count range")
											.otherwise(() => "Exists"),
									)}`
						}
						itemSearchTermsFn={(whenIndex) => {
							const itemUid = readConditionItemUidFn(rule.when[whenIndex]);
							return itemUid.length === 0
								? []
								: [
										itemUid,
										readItemLabelFn(itemUid, ""),
									];
						}}
						label={`${translator.textFn("Rule")} ${ruleIndex + 1} ${translator.textFn("conditions")}`}
						addOptions={(
							[
								{
									type: "exists",
									label: "Exists",
									description:
										"Match when the selected item exists in the search area.",
									icon: <SearchCheck className="size-5" />,
								},
								{
									type: "count",
									label: "Exact count",
									description: "Match an exact number of selected items.",
									icon: <Hash className="size-5" />,
								},
								{
									type: "range",
									label: "Count range",
									description: "Match a range of selected item counts.",
									icon: <MoveHorizontal className="size-5" />,
								},
							] as const
						).map(({ type, label, description, icon }) => ({
							id: type,
							label: translator.textFn(label),
							description: translator.textFn(description),
							icon,
							onSelectFn: () => {
								const query = structuredClone(DraftDefaults.conditionQuery);
								const when: WhenSchema.Type = match(type)
									.with("exists", () => ({
										type: "exists" as const,
										query,
									}))
									.with("count", () => ({
										type: "count" as const,
										query,
										count: 1,
									}))
									.with("range", () => ({
										type: "range" as const,
										query,
										min: 1,
										max: 1,
									}))
									.exhaustive();
								onChangeFn({
									...rule,
									when: [
										...rule.when,
										when,
									],
								});
							},
						}))}
						onRemoveFn={(whenIndex) =>
							onChangeFn({
								...rule,
								when: rule.when.filter(
									(_candidate, candidateIndex) => candidateIndex !== whenIndex,
								) as typeof rule.when,
							})
						}
						renderItemContentFn={(whenIndex, label) => (
							<ConditionOption
								label={label}
								when={rule.when[whenIndex]}
							/>
						)}
						selectedIndex={invalidWhenIndex}
					>
						{(whenIndex) => (
							<WhenControl
								showBranchEnd={ruleTarget !== "set"}
								value={rule.when[whenIndex]}
								onChangeFn={(next) =>
									onChangeFn({
										...rule,
										when: rule.when.map((candidate, candidateIndex) =>
											candidateIndex === whenIndex ? next : candidate,
										) as typeof rule.when,
									})
								}
							/>
						)}
					</EditorCollectionSelector>
				</>
			)}
		</article>
	);
};

/** Assembles the shared conditional Rule collection used by lines and selected drops. */
export const RulesControl = ({
	initialRuleIndex,
	initialWhenIndex,
	allowedTypes,
	description,
	headerVisible = true,
	label,
	onChangeFn,
	rules,
	target,
}: {
	readonly allowedTypes: ReadonlyArray<RuleType>;
	readonly description: ReactNode;
	readonly headerVisible?: boolean;
	readonly label?: string;
	readonly onChangeFn: (rules: RuleValue[]) => void;
	readonly initialRuleIndex?: number;
	readonly initialWhenIndex?: number;
	readonly rules: ReadonlyArray<RuleValue>;
	readonly target: RuleTarget;
}) => {
	const draftRules = rules as ReadonlyArray<DraftRule>;
	const invalidRuleIndex = useFormValidationFocusIndex(rules as object);
	const readItemLabelFn = useEditorItemOptionLabel();
	const translator = useTranslator();
	const collectionLabel = label ?? translator.textFn("Rules");
	const createRuleFn = (type: RuleType): DraftRule =>
		({
			type,
			when: [],
			...match(type)
				.with("runtime:multiplier", () => ({
					multiplier: 1,
				}))
				.with("runtime:adjust", () => ({
					adjustMs: 0,
				}))
				.otherwise(() => ({})),
		}) as DraftRule;
	const emitChangeFn = (next: ReadonlyArray<DraftRule>) => onChangeFn(next as RuleValue[]);
	return (
		<section className="grid gap-3">
			{headerVisible ? (
				<EditorFormSectionDivider
					description={description}
					title={collectionLabel}
					variant="secondary"
				/>
			) : null}
			<EditorCollectionSelector
				dataUi="EditorRulesCollection"
				initialSelectedIndex={initialRuleIndex}
				key={initialRuleIndex}
				count={draftRules.length}
				itemLabelFn={(ruleIndex) =>
					draftRules[ruleIndex].type === undefined
						? `${translator.textFn("Rule")} ${ruleIndex + 1}`
						: `${translator.textFn("Rule")} ${ruleIndex + 1} — ${translator.textFn(
								RuleTypeTranslationKey[draftRules[ruleIndex].type as RuleType],
							)}`
				}
				itemSearchTermsFn={(ruleIndex) =>
					readRuleItemUidsFn(draftRules[ruleIndex]).flatMap((itemUid) => [
						itemUid,
						readItemLabelFn(itemUid, ""),
					])
				}
				label={collectionLabel}
				addOptions={allowedTypes.map(
					(type): ActionMenuOption => ({
						id: type,
						label: translator.textFn(RuleTypeTranslationKey[type]),
						description: translator.textFn(RuleTypeDescriptionKey[type]),
						icon: RuleTypeIcon[type],
						onSelectFn: () =>
							emitChangeFn([
								...draftRules,
								createRuleFn(type),
							]),
					}),
				)}
				onDuplicateFn={(ruleIndex) =>
					emitChangeFn([
						...draftRules.slice(0, ruleIndex + 1),
						structuredClone(draftRules[ruleIndex]),
						...draftRules.slice(ruleIndex + 1),
					])
				}
				onRemoveFn={(ruleIndex) =>
					emitChangeFn(draftRules.filter((_current, index) => index !== ruleIndex))
				}
				renderItemContentFn={(ruleIndex, label) => (
					<RuleOption
						label={label}
						rule={draftRules[ruleIndex]}
					/>
				)}
				selectedIndex={invalidRuleIndex}
			>
				{(ruleIndex) => (
					<RuleControl
						initialWhenIndex={
							ruleIndex === initialRuleIndex ? initialWhenIndex : undefined
						}
						rule={draftRules[ruleIndex]}
						ruleIndex={ruleIndex}
						ruleTarget={target}
						onChangeFn={(next) =>
							emitChangeFn(
								draftRules.map((current, index) =>
									index === ruleIndex ? next : current,
								),
							)
						}
					/>
				)}
			</EditorCollectionSelector>
		</section>
	);
};
