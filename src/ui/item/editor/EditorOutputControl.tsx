import { match } from "ts-pattern";

import type {
	EditorDrop,
	EditorOutput,
	EditorRoll,
	EditorRollSet,
} from "~/bridge/editor/EditorItemModel";
import {
	createEditorDropDraft,
	createEditorRollDraft,
} from "~/bridge/editor/createEditorItemDraft";
import { Button } from "~/ui/button/Button";
import { EditorChoiceControl, EditorNumberControl } from "~/ui/form/EditorValueControls";
import { EditorItemReferenceControl } from "~/ui/item/editor/EditorItemReferenceControl";
import { EditorQuantityControl } from "~/ui/item/editor/EditorQuantityControl";
import { EditorRulesControl } from "~/ui/item/editor/EditorRulesControl";

const EditorDropControl = ({
	index,
	onChange,
	onRemove,
	value,
}: {
	readonly index: number;
	readonly onChange: (drop: EditorDrop) => void;
	readonly onRemove: () => void;
	readonly value: EditorDrop;
}) => (
	<article className="grid gap-3 rounded-lg border border-line bg-surface/60 p-3">
		<header className="flex items-center justify-between gap-3">
			<h5 className="text-xs font-semibold uppercase tracking-wider text-muted">
				Drop {index + 1}
			</h5>
			<Button onClick={onRemove}>Remove</Button>
		</header>
		<EditorItemReferenceControl
			label="Dropped item"
			value={value.itemId}
			onChange={(itemId) =>
				onChange({
					...value,
					itemId,
				})
			}
		/>
		<div className="grid gap-3 sm:grid-cols-2">
			<EditorQuantityControl
				value={value.quantity}
				onChange={(quantity) =>
					onChange({
						...value,
						quantity,
					})
				}
			/>
			<EditorChoiceControl
				label="Board placement"
				value={value.placement}
				options={[
					{
						label: "Local drop",
						value: "drop",
					},
					{
						label: "Random",
						value: "random",
					},
				]}
				onChange={(placement) =>
					onChange({
						...value,
						placement,
					})
				}
			/>
		</div>
		<EditorRulesControl
			rules={value.rules}
			allowedTypes={[
				"enable",
				"disable",
			]}
			onChange={(rules) =>
				onChange({
					...value,
					rules: rules as EditorDrop["rules"],
				})
			}
		/>
	</article>
);

const EditorDropList = ({
	minimum = 1,
	onChange,
	value,
}: {
	readonly minimum?: number;
	readonly onChange: (
		drops: [
			EditorDrop,
			...EditorDrop[],
		],
	) => void;
	readonly value: [
		EditorDrop,
		...EditorDrop[],
	];
}) => {
	return (
		<div className="grid gap-3">
			<div className="flex items-center justify-between gap-3">
				<h4 className="text-sm font-semibold">Drops</h4>
				<Button
					onClick={() =>
						onChange([
							...value,
							createEditorDropDraft(),
						])
					}
				>
					Add drop
				</Button>
			</div>
			{value.map((drop, index) => (
				<EditorDropControl
					key={`${index}:${drop.itemId}`}
					index={index}
					value={drop}
					onChange={(next) =>
						onChange(
							value.map((current, currentIndex) =>
								currentIndex === index ? next : current,
							) as [
								EditorDrop,
								...EditorDrop[],
							],
						)
					}
					onRemove={() => {
						if (value.length <= minimum) return;
						onChange(
							value.filter((_current, currentIndex) => currentIndex !== index) as [
								EditorDrop,
								...EditorDrop[],
							],
						);
					}}
				/>
			))}
		</div>
	);
};

const EditorRollControl = ({
	index,
	onChange,
	onRemove,
	value,
}: {
	readonly index: number;
	readonly onChange: (roll: EditorRoll) => void;
	readonly onRemove: () => void;
	readonly value: EditorRoll;
}) => {
	return (
		<article className="grid gap-4 rounded-xl border border-line bg-canvas/35 p-3">
			<header className="flex items-center justify-between gap-3">
				<h4 className="text-sm font-semibold">Roll {index + 1}</h4>
				<Button onClick={onRemove}>Remove</Button>
			</header>
			<EditorChoiceControl
				label="Roll type"
				value={value.type}
				options={[
					{
						label: "Guaranteed",
						value: "guaranteed",
					},
					{
						label: "Chance",
						value: "chance",
					},
					{
						label: "Weighted",
						value: "weight",
					},
				]}
				onChange={(type) => onChange(createEditorRollDraft(type))}
			/>
			{match(value)
				.with(
					{
						type: "guaranteed",
					},
					(roll) => (
						<EditorDropList
							value={roll.drop}
							onChange={(drop) =>
								onChange({
									...roll,
									drop,
								})
							}
						/>
					),
				)
				.with(
					{
						type: "chance",
					},
					(roll) => (
						<div className="grid gap-3">
							<EditorNumberControl
								label="Chance (0–1)"
								value={roll.chance}
								min={0}
								max={1}
								step={0.01}
								onChange={(chance) =>
									onChange({
										...roll,
										chance,
									})
								}
							/>
							<EditorDropList
								value={roll.drop}
								onChange={(drop) =>
									onChange({
										...roll,
										drop,
									})
								}
							/>
						</div>
					),
				)
				.with(
					{
						type: "weight",
					},
					(roll) => (
						<div className="grid gap-4">
							<EditorQuantityControl
								label="Selections"
								value={roll.quantity}
								onChange={(quantity) =>
									onChange({
										...roll,
										quantity,
									})
								}
							/>
							<div className="grid gap-3">
								<div className="flex items-center justify-between gap-3">
									<h4 className="text-sm font-semibold">Weighted candidates</h4>
									<Button
										onClick={() =>
											onChange({
												...roll,
												drop: [
													...roll.drop,
													{
														weight: 1,
														drop: [
															createEditorDropDraft(),
														],
													},
												],
											})
										}
									>
										Add candidate
									</Button>
								</div>
								{roll.drop.map((candidate, candidateIndex) => (
									<div
										key={`${candidateIndex}`}
										className="grid gap-3 rounded-xl border border-line p-3"
									>
										<div className="flex items-end gap-3">
											<div className="min-w-0 flex-1">
												<EditorNumberControl
													label={`Candidate ${candidateIndex + 1} weight`}
													value={candidate.weight}
													min={1}
													onChange={(weight) =>
														onChange({
															...roll,
															drop: roll.drop.map(
																(current, currentIndex) =>
																	currentIndex === candidateIndex
																		? {
																				...current,
																				weight,
																			}
																		: current,
															) as typeof roll.drop,
														})
													}
												/>
											</div>
											<Button
												onClick={() => {
													if (roll.drop.length <= 2) return;
													onChange({
														...roll,
														drop: roll.drop.filter(
															(_current, currentIndex) =>
																currentIndex !== candidateIndex,
														) as typeof roll.drop,
													});
												}}
											>
												Remove candidate
											</Button>
										</div>
										<EditorDropList
											value={candidate.drop}
											onChange={(drop) =>
												onChange({
													...roll,
													drop: roll.drop.map((current, currentIndex) =>
														currentIndex === candidateIndex
															? {
																	...current,
																	drop,
																}
															: current,
													) as typeof roll.drop,
												})
											}
										/>
									</div>
								))}
							</div>
						</div>
					),
				)
				.exhaustive()}
		</article>
	);
};

const EditorRollSetControl = ({
	index,
	onChange,
	onRemove,
	value,
}: {
	readonly index: number;
	readonly onChange: (set: EditorRollSet) => void;
	readonly onRemove: () => void;
	readonly value: EditorRollSet;
}) => {
	return (
		<section className="grid gap-3 rounded-xl border border-line-strong bg-surface/50 p-3">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<h3 className="text-sm font-semibold">Output set {index + 1}</h3>
				<div className="flex items-center gap-2">
					<Button
						onClick={() =>
							onChange({
								...value,
								weight: value.weight === undefined ? 1 : undefined,
							})
						}
					>
						{value.weight === undefined ? "Add set weight" : "Remove set weight"}
					</Button>
					<Button onClick={onRemove}>Remove set</Button>
				</div>
			</header>
			{value.weight === undefined ? null : (
				<EditorNumberControl
					label="Set weight"
					value={value.weight}
					min={1}
					onChange={(weight) =>
						onChange({
							...value,
							weight,
						})
					}
				/>
			)}
			<div className="flex justify-end">
				<Button
					onClick={() =>
						onChange({
							...value,
							roll: [
								...value.roll,
								createEditorRollDraft("guaranteed"),
							],
						})
					}
				>
					Add roll
				</Button>
			</div>
			{value.roll.map((roll, rollIndex) => (
				<EditorRollControl
					key={`${rollIndex}:${roll.type}`}
					index={rollIndex}
					value={roll}
					onChange={(next) =>
						onChange({
							...value,
							roll: value.roll.map((current, currentIndex) =>
								currentIndex === rollIndex ? next : current,
							) as typeof value.roll,
						})
					}
					onRemove={() => {
						if (value.roll.length === 1) return;
						onChange({
							...value,
							roll: value.roll.filter(
								(_current, currentIndex) => currentIndex !== rollIndex,
							) as typeof value.roll,
						});
					}}
				/>
			))}
		</section>
	);
};

export interface EditorOutputControlProps {
	readonly onChange: (output: EditorOutput) => void;
	readonly value: EditorOutput;
}

/** Edits weighted output sets, discriminated rolls, and their canonical item drops. */
export const EditorOutputControl = ({ onChange, value }: EditorOutputControlProps) => {
	return (
		<div className="grid gap-3">
			<div className="flex justify-end">
				<Button
					onClick={() =>
						onChange({
							set: [
								...value.set,
								{
									roll: [
										createEditorRollDraft("guaranteed"),
									],
								},
							],
						})
					}
				>
					Add output set
				</Button>
			</div>
			{value.set.map((set, index) => (
				<EditorRollSetControl
					key={`${index}`}
					index={index}
					value={set}
					onChange={(next) =>
						onChange({
							set: value.set.map((current, currentIndex) =>
								currentIndex === index ? next : current,
							) as typeof value.set,
						})
					}
					onRemove={() => {
						if (value.set.length === 1) return;
						onChange({
							set: value.set.filter(
								(_current, currentIndex) => currentIndex !== index,
							) as typeof value.set,
						});
					}}
				/>
			))}
		</div>
	);
};
