import { match } from "ts-pattern";

import type {
	EditorDrop,
	EditorOutput,
	EditorRoll,
	EditorRollSet,
} from "~/bridge/item/editor/EditorItemModel";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorChoiceControl, EditorNumberControl } from "~/ui/form/EditorValueControls";
import { EditorItemReferenceControl } from "~/ui/item/editor/EditorItemReferenceControl";
import { EditorQuantityControl } from "~/ui/item/editor/EditorQuantityControl";
import { EditorRulesControl } from "~/ui/item/editor/EditorRulesControl";
import { useEditorItemOptionLabel } from "~/ui/item/editor/useEditorItemOptionLabel";

const readFirstRollItemId = (roll: EditorRoll): string | undefined =>
	roll.type === "weight" ? roll.drop[0]?.drop[0]?.itemId : roll.drop[0]?.itemId;

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
			description="These rules belong only to this item drop. Every condition inside a rule must pass. Enable rules gate this drop and any matching disable rule vetoes it when the roll resolves."
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
	onChange,
	value,
}: {
	readonly onChange: (
		drops:
			| [
					EditorDrop,
					...EditorDrop[],
			  ]
			| undefined,
	) => void;
	readonly value: [
		EditorDrop,
		...EditorDrop[],
	];
}) => {
	const readItemLabel = useEditorItemOptionLabel();
	return (
		<section className="grid gap-3">
			<EditorFormSectionDivider
				description="Items emitted by the currently selected roll."
				title="Drops"
				variant="secondary"
			/>
			<EditorCollectionSelector
				addLabel="Add drop"
				count={value.length}
				itemLabel={(index) => readItemLabel(value[index].itemId, `Drop ${index + 1}`)}
				label="Drops"
				onAdd={() =>
					onChange([
						...value,
						structuredClone(EditorItemDraftDefaults.drop),
					])
				}
				onRemove={(index) =>
					value.length === 1
						? onChange(undefined)
						: onChange(
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
			</EditorCollectionSelector>
		</section>
	);
};

const EditorRollControl = ({
	onChange,
	value,
}: {
	readonly onChange: (roll: EditorRoll | undefined) => void;
	readonly value: EditorRoll;
}) => {
	const readItemLabel = useEditorItemOptionLabel();
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
								drop === undefined
									? onChange(undefined)
									: onChange({
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
									drop === undefined
										? onChange(undefined)
										: onChange({
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
							<EditorFormSectionDivider
								description="Relative weighted alternatives considered by this roll."
								title="Weighted candidates"
								variant="secondary"
							/>
							<EditorCollectionSelector
								addLabel="Add weighted candidate"
								count={roll.drop.length}
								itemLabel={(candidateIndex) => {
									const itemId = roll.drop[candidateIndex].drop[0]?.itemId;
									return readItemLabel(
										itemId ?? "",
										`Candidate ${candidateIndex + 1}`,
									);
								}}
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
								onRemove={(candidateIndex) =>
									roll.drop.length <= 2
										? onChange(undefined)
										: onChange({
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
													drop === undefined
														? roll.drop.length <= 2
															? onChange(undefined)
															: onChange({
																	...roll,
																	drop: roll.drop.filter(
																		(_current, currentIndex) =>
																			currentIndex !==
																			candidateIndex,
																	) as typeof roll.drop,
																})
														: onChange({
																...roll,
																drop: roll.drop.map(
																	(current, currentIndex) =>
																		currentIndex ===
																		candidateIndex
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
							</EditorCollectionSelector>
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
	readonly onChange: (set: EditorRollSet | undefined) => void;
	readonly value: EditorRollSet;
}) => {
	const readItemLabel = useEditorItemOptionLabel();
	return (
		<section className="grid gap-3">
			<EditorNumberControl
				label="Relative set weight"
				value={value.weight}
				min={1}
				onChange={(weight) =>
					onChange({
						...value,
						weight,
					})
				}
			/>
			<EditorFormSectionDivider
				description="Independent rolls resolved by this weighted output set."
				title="Rolls"
				variant="secondary"
			/>
			<EditorCollectionSelector
				addLabel="Add roll"
				count={value.roll.length}
				itemLabel={(rollIndex) => {
					const roll = value.roll[rollIndex];
					const itemId = readFirstRollItemId(roll);
					return `${roll.type} roll ${rollIndex + 1} — ${readItemLabel(
						itemId ?? "",
						"No item selected",
					)}`;
				}}
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
				onRemove={(rollIndex) =>
					value.roll.length === 1
						? onChange(undefined)
						: onChange({
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
							next === undefined
								? value.roll.length === 1
									? onChange(undefined)
									: onChange({
											...value,
											roll: value.roll.filter(
												(_current, currentIndex) =>
													currentIndex !== rollIndex,
											) as typeof value.roll,
										})
								: onChange({
										...value,
										roll: value.roll.map((current, currentIndex) =>
											currentIndex === rollIndex ? next : current,
										) as typeof value.roll,
									})
						}
					/>
				)}
			</EditorCollectionSelector>
		</section>
	);
};

export interface EditorOutputControlProps {
	readonly onChange: (output: EditorOutput | undefined) => void;
	readonly value: EditorOutput;
}

/** Edits weighted output sets, discriminated rolls, and their canonical item drops. */
export const EditorOutputControl = ({ onChange, value }: EditorOutputControlProps) => {
	const readItemLabel = useEditorItemOptionLabel();
	return (
		<section className="grid gap-3">
			<EditorFormSectionDivider
				description="Weighted alternatives resolved when this output runs. A weight of one is the neutral default."
				title="Output sets"
				variant="secondary"
			/>
			<EditorCollectionSelector
				addLabel="Add output set"
				count={value.set.length}
				itemLabel={(index) => {
					const roll = value.set[index].roll[0];
					const itemId = roll === undefined ? undefined : readFirstRollItemId(roll);
					return `Output set ${index + 1} — ${readItemLabel(
						itemId ?? "",
						"No item selected",
					)}`;
				}}
				label="Output sets"
				onAdd={() =>
					onChange({
						set: [
							...value.set,
							{
								weight: 1,
								roll: [
									structuredClone(EditorItemDraftDefaults.rolls.guaranteed),
								],
							},
						],
					})
				}
				onRemove={(index) =>
					value.set.length === 1
						? onChange(undefined)
						: onChange({
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
							next === undefined
								? value.set.length === 1
									? onChange(undefined)
									: onChange({
											set: value.set.filter(
												(_current, currentIndex) => currentIndex !== index,
											) as typeof value.set,
										})
								: onChange({
										set: value.set.map((current, currentIndex) =>
											currentIndex === index ? next : current,
										) as typeof value.set,
									})
						}
					/>
				)}
			</EditorCollectionSelector>
		</section>
	);
};
