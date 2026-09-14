import { match } from "ts-pattern";

import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import type { RuleSchema as ActionRuleSchema } from "~/production-action/schema/RuleSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";
import type { RuleSchema as LineRuleSchema } from "~/production-line/schema/RuleSchema";
import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";
import { BoardDistanceControl } from "~/production-authoring/ui/BoardDistanceControl";
import { SelectorControl } from "~/production-authoring/ui/SelectorControl";
import type { DropRuleSchema } from "~/production-output/schema/DropRuleSchema";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { EditorFormBranchEnd } from "~/editor-control/ui/EditorFormBranchEnd";
import {
	BoardDistancePresentation,
	QueryScopePresentation,
} from "~/item-query/ui/QueryPresentation";
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

type RuleValue = ActionRuleSchema.Type | LineRuleSchema.Type | DropRuleSchema.Type;
type RuleType = LineRuleSchema.Type["type"];
type RuleTarget = "action" | "drop" | "line";
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

const RuleTypeTranslationKey = {
	disable: "Disable",
	enable: "Enable",
	hide: "Hide",
	"runtime:adjust": "Runtime adjustment",
	"runtime:multiplier": "Runtime multiplier",
	show: "Show",
} as const satisfies Record<RuleType, string>;

const readRuleItemIdsFn = (rule: DraftRule): ReadonlyArray<string> => [
	...new Set(
		rule.when.map((when) => when.query.selector.itemId).filter((itemId) => itemId.length > 0),
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
	const itemIds = readRuleItemIdsFn(rule);
	return (
		<EditorCollectionOption
			label={label}
			details={
				<span className="text-xs text-subtle">
					{readRuleSummaryFn(rule, translator.textFn)}
				</span>
			}
		>
			{itemIds.map((itemId) => (
				<EditorItemThumbnail
					key={itemId}
					className="rounded-md"
					resourceIds={
						project.config.items[itemId]?.asset.default ?? [
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
	const scope = textFn(QueryScopePresentation[when.query.scope].label);
	const querySummary =
		when.query.scope === "board"
			? `${scope} · ${textFn(BoardDistancePresentation[when.query.distance].label)}`
			: scope;
	if (when.type === "count") return `${querySummary} · = ${when.count}`;
	if (when.type === "range") return `${querySummary} · ${when.min}–${when.max}`;
	return querySummary;
};

const ConditionOption = ({ label, when }: { readonly label: string; readonly when: DraftWhen }) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const itemId = when.query.selector.itemId;
	return (
		<EditorCollectionOption
			label={label}
			details={
				<span className="text-xs text-subtle">
					{readConditionSummaryFn(when, translator.textFn)}
				</span>
			}
		>
			{itemId.length === 0 ? null : (
				<EditorItemThumbnail
					className="rounded-md"
					resourceIds={
						project.config.items[itemId]?.asset.default ?? [
							"",
						]
					}
					size="md"
				/>
			)}
		</EditorCollectionOption>
	);
};

const queryScopeOptions = [
	{
		...QueryScopePresentation.board,
		value: "board",
	},
	{
		...QueryScopePresentation.inventory,
		value: "inventory",
	},
	{
		...QueryScopePresentation.toolbar,
		value: "toolbar",
	},
	{
		...QueryScopePresentation.any,
		value: "any",
	},
	{
		...QueryScopePresentation.universe,
		value: "universe",
	},
] as const;

const QueryScopeControl = ({
	error,
	onChangeFn,
	value,
}: {
	readonly error?: string;
	readonly onChangeFn: (query: QuerySchema.Type) => void;
	readonly value: QuerySchema.Type;
}) => {
	const translator = useTranslator();
	return (
		<EditorChoiceControl
			error={error}
			label={translator.textFn("Query scope")}
			value={value.scope}
			options={queryScopeOptions.map((option) => ({
				...option,
				label: translator.textFn(option.label),
				description:
					option.value === "board" ? (
						<Mx label="Query scope Board help" />
					) : option.value === "inventory" ? (
						<Mx label="Query scope Inventory help" />
					) : option.value === "toolbar" ? (
						<Mx label="Query scope Toolbar help" />
					) : option.value === "any" ? (
						<Mx label="Query scope Any local help" />
					) : (
						<Mx label="Query scope Universe help" />
					),
			}))}
			onChangeFn={(scope) =>
				onChangeFn(
					scope === "board"
						? {
								scope,
								distance: "close",
								selector: value.selector,
							}
						: {
								scope,
								selector: value.selector,
							},
				)
			}
		/>
	);
};

const readRuleTypeDescriptionFn = (type: RuleType, target: RuleTarget): ReactNode => {
	if (target === "drop")
		return type === "enable" ? (
			<Mx label="Drop enable rule help" />
		) : (
			<Mx label="Drop disable rule help" />
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
	value,
}: {
	readonly onChangeFn: (when: DraftWhen) => void;
	readonly value: DraftWhen;
}) => {
	const validationIssues = useFormValidationIssues(value);
	const translator = useTranslator();
	const selectedValue = value.type === undefined ? undefined : value;
	return (
		<div className="grid min-w-0 gap-3">
			<EditorChoiceControl
				error={readEditorFormValidationErrorFn(validationIssues, "type")}
				label={translator.textFn("Condition type")}
				value={value.type}
				options={[
					{
						description: <Mx label="Exists condition help" />,
						label: translator.textFn("Exists"),
						value: "exists",
					},
					{
						description: <Mx label="Exact count condition help" />,
						label: translator.textFn("Exact count"),
						value: "count",
					},
					{
						description: <Mx label="Count range condition help" />,
						label: translator.textFn("Count range"),
						value: "range",
					},
				]}
				onChangeFn={(type) =>
					onChangeFn(
						type === "exists"
							? {
									type,
									query: value.query,
								}
							: type === "count"
								? {
										type,
										query: value.query,
										count: 1,
									}
								: {
										type,
										query: value.query,
										min: 1,
										max: 1,
									},
					)
				}
			/>
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
					<div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
						<QueryScopeControl
							error={readEditorFormValidationErrorFn(
								validationIssues,
								"query",
								"scope",
							)}
							value={selectedValue.query}
							onChangeFn={(query) =>
								onChangeFn({
									...selectedValue,
									query,
								})
							}
						/>
						{selectedValue.query.scope !== "board" ? null : (
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
					<EditorFormBranchEnd />
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
			<div className="flex items-end gap-3">
				<div className="min-w-0 flex-1">
					<EditorChoiceControl
						error={readEditorFormValidationErrorFn(validationIssues, "type")}
						label={translator.textFn("Rule type")}
						description={ruleTypeDescription}
						value={rule.type}
						options={allowedTypes.map((type) => ({
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
							const itemId = rule.when[whenIndex].query.selector.itemId;
							return itemId.length === 0
								? []
								: [
										itemId,
										readItemLabelFn(itemId, ""),
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
	onChangeFn,
	rules,
	target,
}: {
	readonly allowedTypes: ReadonlyArray<RuleType>;
	readonly description: ReactNode;
	readonly headerVisible?: boolean;
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
					title={translator.textFn("Rules")}
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
					readRuleItemIdsFn(draftRules[ruleIndex]).flatMap((itemId) => [
						itemId,
						readItemLabelFn(itemId, ""),
					])
				}
				label={translator.textFn("Rules")}
				onAddFn={() =>
					emitChangeFn([
						...draftRules,
						{
							when: [],
						},
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
