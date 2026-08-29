import type { RuleSchema as ActionRuleSchema } from "~/production-action/schema/RuleSchema";
import type { RuleSchema as LineRuleSchema } from "~/production-line/schema/rule/RuleSchema";
import type { RuleSchema as DropRuleSchema } from "~/production-output/schema/drop/rule/RuleSchema";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { EditorItemDraftDefaults } from "~/item-authoring/ui/EditorItemDraftDefaults";
import { EditorRuleControl, type EditorRuleTarget } from "~/item-authoring/ui/EditorRuleControl";

type EditorRule = ActionRuleSchema.Type | LineRuleSchema.Type | DropRuleSchema.Type;
type EditorRuleType = LineRuleSchema.Type["type"];

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
				structuredClone(EditorItemDraftDefaults.when),
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
