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

export const EditorRuleControl = ({
	allowedTypes,
	createRule,
	onChange,
	rule,
	ruleIndex,
}: {
	readonly allowedTypes: ReadonlyArray<EditorRuleType>;
	readonly createRule: (type: EditorRuleType) => EditorLineRule;
	readonly onChange: (rule: EditorRule) => void;
	readonly rule: EditorRule;
	readonly ruleIndex: number;
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
					value={rule.type}
					options={allowedTypes.map((type) => ({
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
