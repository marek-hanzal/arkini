import { match } from "ts-pattern";

import type {
	EditorDrop,
	EditorOutput,
	EditorRoll,
	EditorRollSet,
} from "~/bridge/item/editor/EditorItemModel";
import { Button } from "~/ui/button/Button";
import { EditorCollectionTabs } from "~/ui/form/EditorCollectionTabs";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorChoiceControl, EditorNumberControl } from "~/ui/form/EditorValueControls";
import { EditorItemReferenceControl } from "~/ui/item/editor/EditorItemReferenceControl";
import { EditorQuantityControl } from "~/ui/item/editor/EditorQuantityControl";
import { EditorRulesControl } from "~/ui/item/editor/EditorRulesControl";

const EditorDropControl = ({
	onChange,
	value,
}: {
	readonly onChange: (drop: EditorDrop) => void;
	readonly value: EditorDrop;
}) => (
	<div className="grid gap-3">
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
	</div>
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
		<EditorCollectionTabs
			addLabel="Add drop"
			count={value.length}
			itemLabel={(index) => `Drop ${index + 1}`}
			label="Drops"
			onAdd={() =>
				onChange([
					...value,
					structuredClone(EditorItemDraftDefaults.drop),
				])
			}
			onRemove={
				value.length <= minimum
					? undefined
					: (index) =>
							onChange(
								value.filter(
									(_current, currentIndex) => currentIndex !== index,
								) as [
									EditorDrop,
									...EditorDrop[],
								],
							)
			}
			removeLabel="Remove drop"
		>
			{(index) => (
				<EditorDropControl
					value={value[index]}
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
				/>
			)}
		</EditorCollectionTabs>
	);
};

const EditorRollControl = ({
	onChange,
	value,
}: {
	readonly onChange: (roll: EditorRoll) => void;
	readonly value: EditorRoll;
}) => {
	return (
		<div className="grid gap-4">
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
				onChange={(type) => onChange(structuredClone(EditorItemDraftDefaults.rolls[type]))}
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
							<EditorCollectionTabs
								addLabel="Add weighted candidate"
								count={roll.drop.length}
								itemLabel={(candidateIndex) => `Candidate ${candidateIndex + 1}`}
								label="Weighted candidates"
								onAdd={() =>
									onChange({
										...roll,
										drop: [
											...roll.drop,
											{
												weight: 1,
												drop: [
													structuredClone(EditorItemDraftDefaults.drop),
												],
											},
										],
									})
								}
								onRemove={
									roll.drop.length <= 2
										? undefined
										: (candidateIndex) =>
												onChange({
													...roll,
													drop: roll.drop.filter(
														(_current, currentIndex) =>
															currentIndex !== candidateIndex,
													) as typeof roll.drop,
												})
								}
								removeLabel="Remove weighted candidate"
							>
								{(candidateIndex) => {
									const candidate = roll.drop[candidateIndex];
									return (
										<div className="grid gap-3">
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
																		currentIndex ===
																		candidateIndex
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
											</div>
											<EditorDropList
												value={candidate.drop}
												onChange={(drop) =>
													onChange({
														...roll,
														drop: roll.drop.map(
															(current, currentIndex) =>
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
									);
								}}
							</EditorCollectionTabs>
						</div>
					),
				)
				.exhaustive()}
		</div>
	);
};

const EditorRollSetControl = ({
	index,
	onChange,
	value,
}: {
	readonly index: number;
	readonly onChange: (set: EditorRollSet) => void;
	readonly value: EditorRollSet;
}) => {
	return (
		<section className="grid gap-3">
			<header className="flex flex-wrap items-center justify-end gap-3">
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
			<EditorCollectionTabs
				addLabel="Add roll"
				count={value.roll.length}
				itemLabel={(rollIndex) => `Roll ${rollIndex + 1}`}
				label={`Output set ${index + 1} rolls`}
				onAdd={() =>
					onChange({
						...value,
						roll: [
							...value.roll,
							structuredClone(EditorItemDraftDefaults.rolls.guaranteed),
						],
					})
				}
				onRemove={
					value.roll.length === 1
						? undefined
						: (rollIndex) =>
								onChange({
									...value,
									roll: value.roll.filter(
										(_current, currentIndex) => currentIndex !== rollIndex,
									) as typeof value.roll,
								})
				}
				removeLabel="Remove roll"
			>
				{(rollIndex) => (
					<EditorRollControl
						value={value.roll[rollIndex]}
						onChange={(next) =>
							onChange({
								...value,
								roll: value.roll.map((current, currentIndex) =>
									currentIndex === rollIndex ? next : current,
								) as typeof value.roll,
							})
						}
					/>
				)}
			</EditorCollectionTabs>
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
		<EditorCollectionTabs
			addLabel="Add output set"
			count={value.set.length}
			itemLabel={(index) => `Output set ${index + 1}`}
			label="Output sets"
			onAdd={() =>
				onChange({
					set: [
						...value.set,
						{
							roll: [
								structuredClone(EditorItemDraftDefaults.rolls.guaranteed),
							],
						},
					],
				})
			}
			onRemove={
				value.set.length === 1
					? undefined
					: (index) =>
							onChange({
								set: value.set.filter(
									(_current, currentIndex) => currentIndex !== index,
								) as typeof value.set,
							})
			}
			removeLabel="Remove output set"
		>
			{(index) => (
				<EditorRollSetControl
					index={index}
					value={value.set[index]}
					onChange={(next) =>
						onChange({
							set: value.set.map((current, currentIndex) =>
								currentIndex === index ? next : current,
							) as typeof value.set,
						})
					}
				/>
			)}
		</EditorCollectionTabs>
	);
};
