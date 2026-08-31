import { match } from "ts-pattern";

import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import type { RuleSchema as ActionRuleSchema } from "~/production-action/schema/RuleSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";
import type { RuleSchema as LineRuleSchema } from "~/production-line/schema/rule/RuleSchema";
import { EditorProductionDraftDefaults } from "~/production-line-authoring/ui/EditorProductionDraftDefaults";
import { EditorBoardDistanceControl } from "~/production-line-authoring/ui/EditorBoardDistanceControl";
import { EditorSelectorControl } from "~/production-line-authoring/ui/EditorSelectorControl";
import type { RuleSchema as DropRuleSchema } from "~/production-output/schema/drop/rule/RuleSchema";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import {
	EditorChoiceControl,
	EditorNumberControl,
	EditorSecondsControl,
	EditorTextControl,
} from "~/ui/form/EditorValueControls";

type EditorRule = ActionRuleSchema.Type | LineRuleSchema.Type | DropRuleSchema.Type;
type EditorRuleType = LineRuleSchema.Type["type"];
type EditorRuleTarget = "action" | "drop" | "line";

const queryScopeOptions = [
	{
		description:
			"Searches matching items on the current board at the selected distance from the action owner.",
		label: "Board",
		value: "board",
	},
	{
		description: "Searches matching items stored anywhere in the inventory.",
		label: "Inventory",
		value: "inventory",
	},
	{
		description: "Searches matching items stored anywhere in the toolbar.",
		label: "Toolbar",
		value: "toolbar",
	},
	{
		description:
			"Searches the inventory, toolbar, and the current board space without a board-distance limit.",
		label: "Any local",
		value: "any",
	},
	{
		description: "Searches the inventory, toolbar, and every board space in the current game.",
		label: "Universe",
		value: "universe",
	},
] as const;

const EditorQueryScopeControl = ({
	onChange,
	value,
}: {
	readonly onChange: (query: QuerySchema.Type) => void;
	readonly value: QuerySchema.Type;
}) => (
	<EditorChoiceControl
		label="Query scope"
		value={value.scope}
		options={queryScopeOptions}
		onChange={(scope) =>
			onChange(
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

const readRuleTypeDescription = (type: EditorRuleType, target: EditorRuleTarget) => {
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

const EditorWhenControl = ({
	onChange,
	value,
}: {
	readonly onChange: (when: WhenSchema.Type) => void;
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
			onChange={(type) =>
				onChange(
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
				<EditorSelectorControl
					value={value.query.selector}
					onChange={(selector) =>
						onChange({
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
								onChange={(count) =>
									onChange({
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
								onChange={(min) =>
									onChange({
										...when,
										min,
									})
								}
							/>
							<EditorNumberControl
								label="Maximum count"
								value={when.max}
								min={when.min}
								onChange={(max) =>
									onChange({
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
			<EditorQueryScopeControl
				value={value.query}
				onChange={(query) =>
					onChange({
						...value,
						query,
					})
				}
			/>
			{value.query.scope !== "board" ? null : (
				<EditorBoardDistanceControl
					value={value.query}
					onChange={(query) =>
						onChange({
							...value,
							query,
						})
					}
				/>
			)}
		</div>
	</div>
);

const EditorRuleControl = ({
	allowedTypes,
	createRule,
	onChange,
	rule,
	ruleIndex,
	ruleTarget,
	ruleTypeDescription,
}: {
	readonly allowedTypes: ReadonlyArray<EditorRuleType>;
	readonly createRule: (type: EditorRuleType) => LineRuleSchema.Type;
	readonly onChange: (rule: EditorRule) => void;
	readonly rule: EditorRule;
	readonly ruleIndex: number;
	readonly ruleTarget: EditorRuleTarget;
	readonly ruleTypeDescription: string;
}) => (
	<article className="grid gap-3">
		<EditorTextControl
			label="Hint"
			placeholder="Optional explanation shown while this rule applies"
			value={rule.hint ?? ""}
			onChange={(hint) =>
				onChange({
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
						description: readRuleTypeDescription(type, ruleTarget),
						label: type,
						value: type,
					}))}
					onChange={(type) => {
						const next = createRule(type);
						onChange({
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
				onChange={(multiplier) =>
					onChange({
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
				onChange={(adjustSeconds) =>
					onChange({
						...rule,
						adjustMs: Math.round(adjustSeconds * 1_000),
					})
				}
			/>
		)}
		<EditorCollectionSelector
			addLabel="Add condition"
			count={rule.when.length}
			itemLabel={(whenIndex) => `Condition ${whenIndex + 1} — ${rule.when[whenIndex].type}`}
			label={`Rule ${ruleIndex + 1} conditions`}
			onAdd={() =>
				onChange({
					...rule,
					when: [
						...rule.when,
						structuredClone(EditorProductionDraftDefaults.when),
					],
				})
			}
			onRemove={
				rule.when.length === 1
					? undefined
					: (whenIndex) =>
							onChange({
								...rule,
								when: rule.when.filter(
									(_candidate, candidateIndex) => candidateIndex !== whenIndex,
								) as typeof rule.when,
							})
			}
			removeLabel="Remove condition"
		>
			{(whenIndex) => (
				<EditorWhenControl
					value={rule.when[whenIndex]}
					onChange={(next) =>
						onChange({
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
export const EditorRulesControl = ({
	allowedTypes,
	description,
	onChange,
	rules,
	target,
}: {
	readonly allowedTypes: ReadonlyArray<EditorRuleType>;
	readonly description: string;
	readonly onChange: (rules: EditorRule[]) => void;
	readonly rules: ReadonlyArray<EditorRule>;
	readonly target: EditorRuleTarget;
}) => {
	const createRule = (type: EditorRuleType): LineRuleSchema.Type =>
		({
			type,
			when: [
				structuredClone(EditorProductionDraftDefaults.when),
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
				itemLabel={(ruleIndex) => `Rule ${ruleIndex + 1} — ${rules[ruleIndex].type}`}
				label="Rules"
				onAdd={() =>
					onChange([
						...rules,
						createRule(allowedTypes[0]),
					])
				}
				onRemove={(ruleIndex) =>
					onChange(rules.filter((_current, index) => index !== ruleIndex))
				}
				removeLabel="Remove rule"
			>
				{(ruleIndex) => (
					<EditorRuleControl
						allowedTypes={allowedTypes}
						createRule={createRule}
						rule={rules[ruleIndex]}
						ruleIndex={ruleIndex}
						ruleTarget={target}
						ruleTypeDescription={description}
						onChange={(next) =>
							onChange(
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
