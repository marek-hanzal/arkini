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
import { QueryScopePresentation } from "~/item-query/ui/QueryPresentation";
import {
	EditorChoiceControl,
	EditorNumberControl,
	EditorSecondsControl,
	EditorTextControl,
} from "~/editor-control/ui/EditorValueControls";
import { useFormValidationIssues } from "~/item-authoring/ui/useFormValidationIssues";
import { readEditorFormValidationErrorFn } from "~/editor-control/fn/readEditorFormValidationErrorFn";
import { Mx } from "~/translation/ui/Mx";
import { useTranslator } from "~/translation/ui/useTranslator";
import type { ReactNode } from "react";

type RuleValue = ActionRuleSchema.Type | LineRuleSchema.Type | DropRuleSchema.Type;
type RuleType = LineRuleSchema.Type["type"];
type RuleTarget = "action" | "drop" | "line";

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
	readonly onChangeFn: (when: WhenSchema.Type) => void;
	readonly value: WhenSchema.Type;
}) => {
	const validationIssues = useFormValidationIssues(value);
	const translator = useTranslator();
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
			<div className="flex min-w-0 flex-wrap items-end gap-3">
				<div className="min-w-64 flex-1">
					<SelectorControl
						error={readEditorFormValidationErrorFn(
							validationIssues,
							"query",
							"selector",
						)}
						value={value.query.selector}
						onChangeFn={(selector) =>
							onChangeFn({
								...value,
								query: {
									...value.query,
									selector,
								},
							})
						}
					/>
				</div>
				{match(value)
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
							<div className="min-w-64">
								<EditorNumberControl
									error={readEditorFormValidationErrorFn(
										validationIssues,
										"count",
									)}
									label="Exact count"
									value={when.count}
									min={0}
									onChangeFn={(count) =>
										onChangeFn({
											...when,
											count,
										})
									}
								/>
							</div>
						),
					)
					.with(
						{
							type: "range",
						},
						(when) => (
							<div className="grid min-w-96 grid-cols-2 gap-3">
								<EditorNumberControl
									error={readEditorFormValidationErrorFn(validationIssues, "min")}
									label="Minimum count"
									value={when.min}
									min={0}
									onChangeFn={(min) =>
										onChangeFn({
											...when,
											min,
											max: min > when.max ? min : when.max,
										})
									}
								/>
								<EditorNumberControl
									error={readEditorFormValidationErrorFn(validationIssues, "max")}
									label="Maximum count"
									value={when.max}
									min={when.min}
									onChangeFn={(max) =>
										onChangeFn({
											...when,
											max,
										})
									}
								/>
							</div>
						),
					)
					.exhaustive()}
			</div>
			<div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
				<QueryScopeControl
					error={readEditorFormValidationErrorFn(validationIssues, "query", "scope")}
					value={value.query}
					onChangeFn={(query) =>
						onChangeFn({
							...value,
							query,
						})
					}
				/>
				{value.query.scope !== "board" ? null : (
					<BoardDistanceControl
						error={readEditorFormValidationErrorFn(
							validationIssues,
							"query",
							"distance",
						)}
						value={value.query}
						onChangeFn={(query) =>
							onChangeFn({
								...value,
								query,
							})
						}
					/>
				)}
			</div>
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
	readonly createRuleFn: (type: RuleType) => LineRuleSchema.Type;
	readonly onChangeFn: (rule: RuleValue) => void;
	readonly initialWhenIndex?: number;
	readonly rule: RuleValue;
	readonly ruleIndex: number;
	readonly ruleTarget: RuleTarget;
	readonly ruleTypeDescription: ReactNode;
}) => {
	const validationIssues = useFormValidationIssues(rule);
	const invalidWhenIndex = validationIssues.find(
		(issue) => issue.path[0] === "when" && typeof issue.path[1] === "number",
	)?.path[1] as number | undefined;
	return (
		<article className="grid gap-3">
			<EditorTextControl
				error={readEditorFormValidationErrorFn(validationIssues, "hint")}
				label="Hint"
				placeholder="Optional explanation shown while this rule applies"
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
			<div className="flex items-end gap-3">
				<div className="min-w-0 flex-1">
					<EditorChoiceControl
						error={readEditorFormValidationErrorFn(validationIssues, "type")}
						label="Rule type"
						description={ruleTypeDescription}
						value={rule.type}
						options={allowedTypes.map((type) => ({
							description: readRuleTypeDescriptionFn(type, ruleTarget),
							label: type,
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
			{rule.type !== "runtime:multiplier" ? null : (
				<EditorNumberControl
					error={readEditorFormValidationErrorFn(validationIssues, "multiplier")}
					label="Runtime multiplier"
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
					label="Runtime adjustment (seconds)"
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
				addLabel="Add condition"
				initialSelectedIndex={initialWhenIndex}
				key={initialWhenIndex}
				count={rule.when.length}
				itemLabelFn={(whenIndex) =>
					`Condition ${whenIndex + 1} — ${rule.when[whenIndex].type}`
				}
				label={`Rule ${ruleIndex + 1} conditions`}
				onAddFn={() =>
					onChangeFn({
						...rule,
						when: [
							...rule.when,
							structuredClone(DraftDefaults.when),
						],
					})
				}
				onRemoveFn={
					rule.when.length === 1
						? undefined
						: (whenIndex) =>
								onChangeFn({
									...rule,
									when: rule.when.filter(
										(_candidate, candidateIndex) =>
											candidateIndex !== whenIndex,
									) as typeof rule.when,
								})
				}
				removeLabel="Remove condition"
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
	const validationIssues = useFormValidationIssues(rules as object);
	const invalidRuleIndex = validationIssues.find((issue) => typeof issue.path[0] === "number")
		?.path[0] as number | undefined;
	const createRuleFn = (type: RuleType): LineRuleSchema.Type =>
		({
			type,
			when: [
				structuredClone(DraftDefaults.when),
			],
			...(type === "runtime:multiplier"
				? {
						multiplier: 1,
					}
				: type === "runtime:adjust"
					? {
							adjustMs: 0,
						}
					: {}),
		}) as LineRuleSchema.Type;
	return (
		<section className="grid gap-3">
			{headerVisible ? (
				<EditorFormSectionDivider
					description={description}
					title="Rules"
					variant="secondary"
				/>
			) : null}
			<EditorCollectionSelector
				addLabel="Add rule"
				initialSelectedIndex={initialRuleIndex}
				key={initialRuleIndex}
				count={rules.length}
				itemLabelFn={(ruleIndex) => `Rule ${ruleIndex + 1} — ${rules[ruleIndex].type}`}
				label="Rules"
				onAddFn={() =>
					onChangeFn([
						...rules,
						createRuleFn(allowedTypes[0]),
					])
				}
				onRemoveFn={(ruleIndex) =>
					onChangeFn(rules.filter((_current, index) => index !== ruleIndex))
				}
				removeLabel="Remove rule"
				selectedIndex={invalidRuleIndex}
			>
				{(ruleIndex) => (
					<RuleControl
						initialWhenIndex={
							ruleIndex === initialRuleIndex ? initialWhenIndex : undefined
						}
						allowedTypes={allowedTypes}
						createRuleFn={createRuleFn}
						rule={rules[ruleIndex]}
						ruleIndex={ruleIndex}
						ruleTarget={target}
						ruleTypeDescription={description}
						onChangeFn={(next) =>
							onChangeFn(
								rules.map((current, index) =>
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
