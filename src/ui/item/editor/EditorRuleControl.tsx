import type { EditorDropRule, EditorLineRule } from "~/bridge/item/editor/EditorItemModel";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import {
	EditorChoiceControl,
	EditorNumberControl,
	EditorSecondsControl,
	EditorTextControl,
} from "~/ui/form/EditorValueControls";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorWhenControl } from "~/ui/item/editor/EditorWhenControl";

type EditorRule = EditorLineRule | EditorDropRule;
type EditorRuleType = EditorLineRule["type"];
export type EditorRuleTarget = "drop" | "line";

const readRuleTypeDescription = (type: EditorRuleType, target: EditorRuleTarget) => {
	if (target === "drop")
		return type === "enable"
			? "Allows this selected drop only while every condition passes. It does not enable or disable the production line itself."
			: "Suppresses this selected drop while every condition passes. It does not disable the production line or other drops.";
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

export const EditorRuleControl = ({
	allowedTypes,
	createRule,
	onChange,
	rule,
	ruleIndex,
	ruleTarget,
	ruleTypeDescription,
}: {
	readonly allowedTypes: ReadonlyArray<EditorRuleType>;
	readonly createRule: (type: EditorRuleType) => EditorLineRule;
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
						structuredClone(EditorItemDraftDefaults.when),
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
