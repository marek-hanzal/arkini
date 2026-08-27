import type {
	EditorActionRule,
	EditorDropRule,
	EditorLineRule,
} from "~/bridge/item/editor/EditorItemModel";
import { twMerge } from "tailwind-merge";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorRuleControl, type EditorRuleTarget } from "~/ui/item/editor/EditorRuleControl";

type EditorRule = EditorActionRule | EditorLineRule | EditorDropRule;
type EditorRuleType = EditorLineRule["type"];

/** Assembles the shared conditional Rule collection used by lines and selected drops. */
export const EditorRulesControl = ({
	allowedTypes,
	className,
	description,
	onChange,
	rules,
	target,
}: {
	readonly allowedTypes: ReadonlyArray<EditorRuleType>;
	readonly className?: string;
	readonly description: string;
	readonly onChange: (rules: EditorRule[]) => void;
	readonly rules: ReadonlyArray<EditorRule>;
	readonly target: EditorRuleTarget;
}) => {
	const createRule = (type: EditorRuleType): EditorLineRule =>
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
		}) as EditorLineRule;
	return (
		<section className={twMerge("grid gap-3", className)}>
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
