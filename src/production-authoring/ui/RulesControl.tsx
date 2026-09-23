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
	EditorChoiceControl,
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
import { Mx } from "~/translation/ui/Mx";
import { useTranslator } from "~/translation/ui/useTranslator";
import type { ReactNode } from "react";
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

const readRuleTypeDescriptionFn = (type: RuleType, target: RuleTarget): ReactNode => {
	if (target === "set")
		return type === "enable" ? (
			<Mx label="Outcome set enable rule help" />
		) : (
			<Mx label="Outcome set disable rule help" />
		);
	if (target === "outcome")
		return type === "enable" ? (
			<Mx label="Outcome enable rule help" />
		) : (
			<Mx label="Outcome disable rule help" />
		);
	if (target === "action")
		return type === "enable" ? (
			<Mx label="Action enable rule help" />
		) : (
			<Mx label="Action disable rule help" />
		);
	if (type === "show") return <Mx label="Production show rule help" />;
	if (type === "hide") return <Mx label="Production hide rule help" />;
	if (type === "enable") return <Mx label="Production enable rule help" />;
	if (type === "disable") return <Mx label="Production disable rule help" />;
	if (type === "runtime:adjust") return <Mx label="Production runtime adjustment rule help" />;
	return <Mx label="Production runtime multiplier rule help" />;
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
			<div className="flex min-w-0 items-start justify-between gap-3">
				<EditorChoiceControl
					error={readEditorFormValidationErrorFn(validationIssues, "type")}
					label={translator.textFn("Condition type")}
					value={value.type}
					options={[
						{
							description: <Mx label="Exists condition help" />,
							icon: <SearchCheck className="size-4 shrink-0" />,
							label: translator.textFn("Exists"),
							value: "exists",
						},
						{
							description: <Mx label="Exact count condition help" />,
							icon: <Hash className="size-4 shrink-0" />,
							label: translator.textFn("Exact count"),
							value: "count",
						},
						{
							description: <Mx label="Count range condition help" />,
							icon: <MoveHorizontal className="size-4 shrink-0" />,
							label: translator.textFn("Count range"),
							value: "range",
						},
					]}
					onChangeFn={(type) => {
						const query = value.query;
						onChangeFn(
							type === "exists"
								? {
										type,
										query,
									}
								: type === "count"
									? {
											type,
											query,
											count: 1,
										}
									: {
											type,
											query,
											min: 1,
											max: 1,
										},
						);
					}}
				/>
				{selectedValue === undefined ? null : (
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
				)}
			</div>
			{selectedValue === undefined ? null : (
				<>
					<SelectorControl
						error={readEditorFormValidationErrorFn(
							validationIssues,
							"query",
							"selector",
						)}
						labelVisible={false}
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
	allowedTypes,
	createRuleFn,
	onChangeFn,
	rule,
	ruleIndex,
	ruleTarget,
	ruleTypeDescription,
}: {
	readonly allowedTypes: ReadonlyArray<RuleType>;
	readonly createRuleFn: (type: RuleType) => DraftRule;
	readonly onChangeFn: (rule: DraftRule) => void;
	readonly initialWhenIndex?: number;
	readonly rule: DraftRule;
	readonly ruleIndex: number;
	readonly ruleTarget: RuleTarget;
	readonly ruleTypeDescription: ReactNode;
}) => {
	const validationIssues = useFormValidationIssues(rule);
	const invalidWhenIndex = useFormValidationFocusIndex(rule, "when");
	const readItemLabelFn = useEditorItemOptionLabel();
	const translator = useTranslator();
	return (
		<article className="grid gap-3">
			<div className="flex items-end justify-end gap-3">
				<div className="min-w-0">
					<EditorChoiceControl
						error={readEditorFormValidationErrorFn(validationIssues, "type")}
						label={translator.textFn("Rule type")}
						description={ruleTypeDescription}
						value={rule.type}
						options={allowedTypes.map((type) => ({
							icon: RuleTypeIcon[type],
							description: readRuleTypeDescriptionFn(type, ruleTarget),
							label: translator.textFn(RuleTypeTranslationKey[type]),
							value: type,
						}))}
						onChangeFn={(type) => {
							const next = createRuleFn(type);
							onChangeFn({
								...next,
								...(rule.hint === undefined
									? {}
									: {
											hint: rule.hint,
										}),
								when: rule.when,
							});
						}}
					/>
				</div>
			</div>
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
										rule.when[whenIndex].type === "count"
											? "Exact count"
											: rule.when[whenIndex].type === "range"
												? "Count range"
												: "Exists",
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
						onAddFn={() =>
							onChangeFn({
								...rule,
								when: [
									...rule.when,
									structuredClone(DraftDefaults.when),
								],
							})
						}
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
			...(type === "runtime:multiplier"
				? {
						multiplier: 1,
					}
				: type === "runtime:adjust"
					? {
							adjustMs: 0,
						}
					: {}),
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
				onAddFn={() =>
					emitChangeFn([
						...draftRules,
						{
							when: [],
						},
					])
				}
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
						allowedTypes={allowedTypes}
						createRuleFn={createRuleFn}
						rule={draftRules[ruleIndex]}
						ruleIndex={ruleIndex}
						ruleTarget={target}
						ruleTypeDescription={description}
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
