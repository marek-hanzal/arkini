import { match } from "ts-pattern";

import type { EditorDropRule, EditorLineRule, EditorWhen } from "~/bridge/item/editor/EditorItemModel";
import {
	createEditorLineRuleDraft,
	createEditorWhenDraft,
} from "~/bridge/item/editor/createEditorItemDraft";
import { Button } from "~/ui/button/Button";
import { EditorChoiceControl, EditorNumberControl } from "~/ui/form/EditorValueControls";
import { EditorQueryControl } from "~/ui/item/editor/EditorQueryControl";

type EditorRule = EditorLineRule | EditorDropRule;
type EditorRuleType = EditorLineRule["type"];

const EditorWhenControl = ({
	index,
	onChange,
	onRemove,
	value,
}: {
	readonly index: number;
	readonly onChange: (when: EditorWhen) => void;
	readonly onRemove: () => void;
	readonly value: EditorWhen;
}) => (
	<div className="grid gap-3 rounded-lg border border-line p-3">
		<div className="flex items-end gap-3">
			<div className="min-w-0 flex-1">
				<EditorChoiceControl
					label={`Condition ${index + 1}`}
					value={value.type}
					options={[
						{
							label: "Exists",
							value: "exists",
						},
						{
							label: "Exact count",
							value: "count",
						},
						{
							label: "Count range",
							value: "range",
						},
					]}
					onChange={(type) => onChange(createEditorWhenDraft(type, value.query))}
				/>
			</div>
			<Button onClick={onRemove}>Remove</Button>
		</div>
		<EditorQueryControl
			value={value.query}
			onChange={(query) =>
				onChange({
					...value,
					query,
				})
			}
		/>
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
				),
			)
			.with(
				{
					type: "range",
				},
				(when) => (
					<div className="grid gap-3 sm:grid-cols-2">
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
);

/** Edits the shared conditional core used by both line and selected-drop rules. */
export const EditorRulesControl = ({
	allowedTypes,
	onChange,
	rules,
}: {
	readonly allowedTypes: ReadonlyArray<EditorRuleType>;
	readonly onChange: (rules: EditorRule[]) => void;
	readonly rules: ReadonlyArray<EditorRule>;
}) => (
	<section className="grid gap-3 border-t border-line pt-4">
		<header className="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h4 className="text-sm font-semibold">Rules</h4>
				<p className="mt-1 text-xs text-muted">All conditions within one rule must pass.</p>
			</div>
			<div className="flex flex-wrap gap-2">
				{allowedTypes.map((type) => (
					<Button
						key={type}
						onClick={() =>
							onChange([
								...rules,
								createEditorLineRuleDraft(type),
							])
						}
					>
						Add {type}
					</Button>
				))}
			</div>
		</header>
		{rules.map((rule, ruleIndex) => (
			<article
				key={`${ruleIndex}:${rule.type}`}
				className="grid gap-3 rounded-xl border border-line bg-surface/50 p-3"
			>
				<div className="flex items-end gap-3">
					<div className="min-w-0 flex-1">
						<EditorChoiceControl
							label={`Rule ${ruleIndex + 1}`}
							value={rule.type}
							options={allowedTypes.map((type) => ({
								label: type,
								value: type,
							}))}
							onChange={(type) => {
								const next = createEditorLineRuleDraft(type);
								onChange(
									rules.map((current, index) =>
										index === ruleIndex
											? {
													...next,
													when: current.when,
												}
											: current,
									),
								);
							}}
						/>
					</div>
					<Button
						onClick={() =>
							onChange(rules.filter((_current, index) => index !== ruleIndex))
						}
					>
						Remove rule
					</Button>
				</div>
				{rule.type !== "runtime:multiplier" ? null : (
					<EditorNumberControl
						label="Runtime multiplier"
						value={rule.multiplier}
						min={0.01}
						step={0.01}
						onChange={(multiplier) =>
							onChange(
								rules.map((current, index) =>
									index === ruleIndex && current.type === "runtime:multiplier"
										? {
												...current,
												multiplier,
											}
										: current,
								),
							)
						}
					/>
				)}
				<div className="flex justify-end">
					<Button
						onClick={() =>
							onChange(
								rules.map((current, index) =>
									index === ruleIndex
										? {
												...current,
												when: [
													...current.when,
													createEditorWhenDraft("exists"),
												],
											}
										: current,
								),
							)
						}
					>
						Add condition
					</Button>
				</div>
				{rule.when.map((when, whenIndex) => (
					<EditorWhenControl
						key={`${whenIndex}:${when.type}`}
						index={whenIndex}
						value={when}
						onChange={(next) =>
							onChange(
								rules.map((current, index) =>
									index === ruleIndex
										? {
												...current,
												when: current.when.map(
													(candidate, candidateIndex) =>
														candidateIndex === whenIndex
															? next
															: candidate,
												) as typeof current.when,
											}
										: current,
								),
							)
						}
						onRemove={() => {
							if (rule.when.length === 1) return;
							onChange(
								rules.map((current, index) =>
									index === ruleIndex
										? {
												...current,
												when: current.when.filter(
													(_candidate, candidateIndex) =>
														candidateIndex !== whenIndex,
												) as typeof current.when,
											}
										: current,
								),
							);
						}}
					/>
				))}
			</article>
		))}
	</section>
);
