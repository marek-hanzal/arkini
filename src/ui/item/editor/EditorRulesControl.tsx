import { match } from "ts-pattern";

import type {
	EditorDropRule,
	EditorLineRule,
	EditorWhen,
} from "~/bridge/item/editor/EditorItemModel";
import { twMerge } from "tailwind-merge";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorChoiceControl, EditorNumberControl } from "~/ui/form/EditorValueControls";
import { EditorQueryControl } from "~/ui/item/editor/EditorQueryControl";

type EditorRule = EditorLineRule | EditorDropRule;
type EditorRuleType = EditorLineRule["type"];

const EditorWhenControl = ({
	onChange,
	value,
}: {
	readonly onChange: (when: EditorWhen) => void;
	readonly value: EditorWhen;
}) => (
	<div className="grid gap-3">
		<EditorChoiceControl
			label="Condition type"
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
	className,
	description,
	onChange,
	rules,
}: {
	readonly allowedTypes: ReadonlyArray<EditorRuleType>;
	readonly className?: string;
	readonly description: string;
	readonly onChange: (rules: EditorRule[]) => void;
	readonly rules: ReadonlyArray<EditorRule>;
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
		<section className={twMerge("grid gap-3 border-t border-line pt-4", className)}>
			<header>
				<div className="flex items-center gap-1">
					<h4 className="text-sm font-semibold">Rules</h4>
					<EditorInfoTooltip content={description} />
				</div>
			</header>
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
				{(ruleIndex) => {
					const rule = rules[ruleIndex];
					return (
						<article className="grid gap-3">
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
												index === ruleIndex &&
												current.type === "runtime:multiplier"
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
							{rule.type !== "runtime:adjust" ? null : (
								<EditorNumberControl
									label="Runtime adjustment (seconds)"
									value={rule.adjustMs / 1_000}
									step={0.001}
									onChange={(adjustSeconds) =>
										onChange(
											rules.map((current, index) =>
												index === ruleIndex &&
												current.type === "runtime:adjust"
													? {
															...current,
															adjustMs: Math.round(
																adjustSeconds * 1_000,
															),
														}
													: current,
											),
										)
									}
								/>
							)}
							<EditorCollectionSelector
								addLabel="Add condition"
								count={rule.when.length}
								itemLabel={(whenIndex) =>
									`Condition ${whenIndex + 1} — ${rule.when[whenIndex].type}`
								}
								label={`Rule ${ruleIndex + 1} conditions`}
								onAdd={() =>
									onChange(
										rules.map((current, index) =>
											index === ruleIndex
												? {
														...current,
														when: [
															...current.when,
															structuredClone(
																EditorItemDraftDefaults.when,
															),
														],
													}
												: current,
										),
									)
								}
								onRemove={
									rule.when.length === 1
										? undefined
										: (whenIndex) =>
												onChange(
													rules.map((current, index) =>
														index === ruleIndex
															? {
																	...current,
																	when: current.when.filter(
																		(
																			_candidate,
																			candidateIndex,
																		) =>
																			candidateIndex !==
																			whenIndex,
																	) as typeof current.when,
																}
															: current,
													),
												)
								}
								removeLabel="Remove condition"
							>
								{(whenIndex) => (
									<EditorWhenControl
										value={rule.when[whenIndex]}
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
									/>
								)}
							</EditorCollectionSelector>
						</article>
					);
				}}
			</EditorCollectionSelector>
		</section>
	);
};
