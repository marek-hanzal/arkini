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
	onChangeFn,
	value,
}: {
	readonly onChangeFn: (query: QuerySchema.Type) => void;
	readonly value: QuerySchema.Type;
}) => (
	<EditorChoiceControl
		label="Query scope"
		value={value.scope}
		options={queryScopeOptions}
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

const readRuleTypeDescriptionFn = (type: RuleType, target: RuleTarget) => {
	if (target === "drop")
		return type === "enable"
			? "Allows this selected drop only while every condition passes. It does not enable or disable the production line itself."
			: "Suppresses this selected drop while every condition passes. It does not disable the production line or other drops.";
	if (target === "action")
		return type === "enable"
			? "Acts as a positive gate for this item action. Every Enable rule must pass, while a matching Disable rule still vetoes activation."
			: "Disables this item action while every condition passes, regardless of its authored Enabled state or passing Enable rules.";
	if (type === "show")
		return "Shows this production line while every condition passes. A matching Hide rule still has veto power.";
	if (type === "hide")
		return "Hides this production line while every condition passes, regardless of its authored visibility or matching Show rules.";
	if (type === "enable")
		return "Acts as a positive gate for this production line. When Enable rules exist, every one must pass; a matching Disable rule still vetoes availability.";
	if (type === "disable")
		return "Disables this production line while every condition passes, regardless of its authored Enabled state or passing Enable rules.";
	if (type === "runtime:adjust")
		return "Adds the configured signed duration to this production line while every condition passes.";
	return "Multiplies this production line's runtime while every condition passes. Active multipliers are applied before runtime adjustments.";
};

const WhenControl = ({
	onChangeFn,
	value,
}: {
	readonly onChangeFn: (when: WhenSchema.Type) => void;
	readonly value: WhenSchema.Type;
}) => (
	<div className="grid min-w-0 gap-3">
		<EditorChoiceControl
			label="Condition type"
			value={value.type}
			options={[
				{
					description: "Passes when the query finds any positive item quantity.",
					label: "Exists",
					value: "exists",
				},
				{
					description:
						"Passes only when the query finds exactly the configured total item quantity.",
					label: "Exact count",
					value: "count",
				},
				{
					description:
						"Passes when the query finds a total item quantity inside the configured inclusive range.",
					label: "Count range",
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
								label="Minimum count"
								value={when.min}
								min={0}
								onChangeFn={(min) =>
									onChangeFn({
										...when,
										min,
									})
								}
							/>
							<EditorNumberControl
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

const RuleControl = ({
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
	readonly rule: RuleValue;
	readonly ruleIndex: number;
	readonly ruleTarget: RuleTarget;
	readonly ruleTypeDescription: string;
}) => (
	<article className="grid gap-3">
		<EditorTextControl
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
				label="Runtime adjustment (seconds)"
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
			count={rule.when.length}
			itemLabelFn={(whenIndex) => `Condition ${whenIndex + 1} — ${rule.when[whenIndex].type}`}
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
									(_candidate, candidateIndex) => candidateIndex !== whenIndex,
								) as typeof rule.when,
							})
			}
			removeLabel="Remove condition"
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

/** Assembles the shared conditional Rule collection used by lines and selected drops. */
export const RulesControl = ({
	allowedTypes,
	description,
	onChangeFn,
	rules,
	target,
}: {
	readonly allowedTypes: ReadonlyArray<RuleType>;
	readonly description: string;
	readonly onChangeFn: (rules: RuleValue[]) => void;
	readonly rules: ReadonlyArray<RuleValue>;
	readonly target: RuleTarget;
}) => {
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
			<EditorFormSectionDivider
				description={description}
				title="Rules"
				variant="secondary"
			/>
			<EditorCollectionSelector
				addLabel="Add rule"
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
			>
				{(ruleIndex) => (
					<RuleControl
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
