import { Info } from "lucide-react";
import { match } from "ts-pattern";

import { DraftDefaults } from "~/production-authoring/ui/DraftDefaults";
import { QuantityControl, QuantityFields } from "~/production-authoring/ui/QuantityControl";
import { RulesControl } from "~/production-authoring/ui/RulesControl";
import type { DropSchema } from "~/production-output/schema/DropSchema";
import type { RollSchema } from "~/production-output/schema/RollSchema";
import type { RollSetSchema } from "~/production-output/schema/RollSetSchema";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { EditorChoiceControl, EditorNumberControl } from "~/editor-control/ui/EditorValueControls";
import { EditorItemReferenceControl } from "~/authoring-form/ui/EditorItemAutocompleteField";
import { useEditorItemOptionLabel } from "~/authoring-form/ui/useEditorItemSearchOptions";
import { Tooltip } from "~/ui/ui/Tooltip";

type DropListValue = [
	DropSchema.Type,
	...DropSchema.Type[],
];
type WeightedRoll = Extract<
	RollSchema.Type,
	{
		readonly type: "weight";
	}
>;

const readChancePercentFn = (chance: number) => Number((chance * 100).toFixed(6));
const readFirstRollItemIdFn = (roll: RollSchema.Type): string | undefined =>
	roll.type === "weight" ? roll.drop[0]?.drop[0]?.itemId : roll.drop[0]?.itemId;

const DropControl = ({
	onChangeFn,
	value,
}: {
	readonly onChangeFn: (drop: DropSchema.Type) => void;
	readonly value: DropSchema.Type;
}) => (
	<div className="grid gap-3">
		<EditorItemReferenceControl
			label="Dropped item"
			value={value.itemId}
			onChangeFn={(itemId) =>
				onChangeFn({
					...value,
					itemId,
				})
			}
		/>
		<div className="flex flex-wrap items-end justify-between gap-3">
			<div className="min-w-0 basis-full sm:basis-1/2">
				<QuantityControl
					value={value.quantity}
					onChangeFn={(quantity) =>
						onChangeFn({
							...value,
							quantity,
						})
					}
				/>
			</div>
			<EditorChoiceControl
				label="Board placement"
				value={value.placement}
				options={[
					{
						description:
							"Starts board placement at the production origin, then places stack-first into the nearest available cells.",
						label: "Local drop",
						value: "drop",
					},
					{
						description:
							"Chooses a random cell in the current board space as the placement origin, then places stack-first into the nearest available cells.",
						label: "Random",
						value: "random",
					},
				]}
				onChangeFn={(placement) =>
					onChangeFn({
						...value,
						placement,
					})
				}
			/>
		</div>
		<RulesControl
			rules={value.rules}
			target="drop"
			description="These rules belong only to this item drop. Every condition inside a rule must pass. Enable rules gate this drop and any matching disable rule vetoes it when the roll resolves."
			allowedTypes={[
				"enable",
				"disable",
			]}
			onChangeFn={(rules) =>
				onChangeFn({
					...value,
					rules: rules as DropSchema.Type["rules"],
				})
			}
		/>
	</div>
);

const DropList = ({
	onChangeFn,
	value,
}: {
	readonly onChangeFn: (drops: DropListValue | undefined) => void;
	readonly value: DropListValue;
}) => {
	const readItemLabelFn = useEditorItemOptionLabel();
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
				itemLabelFn={(index) => readItemLabelFn(value[index].itemId, `Drop ${index + 1}`)}
				label="Drops"
				onAddFn={() =>
					onChangeFn([
						...value,
						structuredClone(DraftDefaults.drop),
					])
				}
				onRemoveFn={(index) =>
					value.length === 1
						? onChangeFn(undefined)
						: onChangeFn(
								value.filter(
									(_current, currentIndex) => currentIndex !== index,
								) as DropListValue,
							)
				}
				removeLabel="Remove drop"
			>
				{(index) => (
					<DropControl
						value={value[index]}
						onChangeFn={(next) =>
							onChangeFn(
								value.map((current, currentIndex) =>
									currentIndex === index ? next : current,
								) as DropListValue,
							)
						}
					/>
				)}
			</EditorCollectionSelector>
		</section>
	);
};

const WeightedSelectionsHelp = () => (
	<div className="grid gap-3">
		<div className="grid gap-1">
			<p className="font-semibold text-foreground">What Selections controls</p>
			<p className="text-muted">
				The game first chooses how many times to pick a weighted candidate, then performs
				that many independent picks. Every pick emits all drops configured inside its
				selected candidate.
			</p>
		</div>
		<div className="grid gap-2 rounded-lg border border-line bg-surface/70 p-3">
			<p className="text-xs font-semibold uppercase tracking-wide text-muted">Examples</p>
			<div className="grid gap-1.5 text-foreground">
				<p>
					<span className="font-semibold">Minimum 1, Maximum 1:</span> pick exactly one
					candidate. Use this for one weighted reward.
				</p>
				<p>
					<span className="font-semibold">Minimum 3, Maximum 3:</span> make exactly three
					picks. Use this for a fixed bundle of three weighted rewards.
				</p>
				<p>
					<span className="font-semibold">Minimum 2, Maximum 4:</span> randomly make two,
					three, or four picks. Use this for a variable-size reward bundle.
				</p>
			</div>
		</div>
		<p className="text-muted">
			<span className="font-semibold text-foreground">Weights apply to every pick.</span>{" "}
			Candidates weighted 70 and 30 have 70% and 30% odds per pick. Picks do not remove a
			candidate, so the same candidate may win repeatedly.
		</p>
	</div>
);

const WeightedRollControl = ({
	onChangeFn,
	roll,
}: {
	readonly onChangeFn: (roll: RollSchema.Type | undefined) => void;
	readonly roll: WeightedRoll;
}) => {
	const readItemLabelFn = useEditorItemOptionLabel();
	return (
		<div className="grid gap-4">
			<div className="grid gap-3">
				<div className="text-sm">
					<span className="flex h-5 min-w-0 items-center gap-1 leading-5">
						<span className="font-semibold text-foreground">Selections</span>
						<Tooltip
							content={<WeightedSelectionsHelp />}
							contentClassName="max-w-lg p-4 text-sm leading-6"
						>
							<button
								type="button"
								data-ui="EditorInfoTooltip"
								className="grid size-5 min-h-0 min-w-0 shrink-0 cursor-help place-items-center rounded-full border-0 bg-transparent p-0 text-muted hover:text-foreground"
								onClick={(event) => {
									event.preventDefault();
									event.stopPropagation();
								}}
							>
								<Info className="size-4" />
							</button>
						</Tooltip>
					</span>
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
					<QuantityFields
						minimumDescription="Lowest number of independent candidate selections this roll may perform when it resolves."
						maximumDescription="Highest number of independent candidate selections this roll may perform. The actual integer count is chosen from Minimum through Maximum, inclusive."
						value={roll.quantity}
						onChangeFn={(quantity) =>
							onChangeFn({
								...roll,
								quantity,
							})
						}
					/>
				</div>
			</div>
			<EditorFormSectionDivider
				description="Relative weighted alternatives considered by this roll."
				title="Weighted candidates"
				variant="secondary"
			/>
			<EditorCollectionSelector
				addLabel="Add weighted candidate"
				count={roll.drop.length}
				itemLabelFn={(candidateIndex) => {
					const itemId = roll.drop[candidateIndex].drop[0]?.itemId;
					return readItemLabelFn(itemId ?? "", `Candidate ${candidateIndex + 1}`);
				}}
				label="Weighted candidates"
				onAddFn={() =>
					onChangeFn({
						...roll,
						drop: [
							...roll.drop,
							{
								weight: 1,
								drop: [
									structuredClone(DraftDefaults.drop),
								],
							},
						],
					})
				}
				onRemoveFn={(candidateIndex) =>
					roll.drop.length <= 2
						? onChangeFn(undefined)
						: onChangeFn({
								...roll,
								drop: roll.drop.filter(
									(_current, currentIndex) => currentIndex !== candidateIndex,
								) as typeof roll.drop,
							})
				}
				removeLabel="Remove weighted candidate"
			>
				{(candidateIndex) => {
					const candidate = roll.drop[candidateIndex];
					const removeCandidateFn = () =>
						roll.drop.length <= 2
							? onChangeFn(undefined)
							: onChangeFn({
									...roll,
									drop: roll.drop.filter(
										(_current, currentIndex) => currentIndex !== candidateIndex,
									) as typeof roll.drop,
								});
					return (
						<div className="grid gap-3">
							<EditorNumberControl
								label={`Candidate ${candidateIndex + 1} weight`}
								value={candidate.weight}
								min={1}
								onChangeFn={(weight) =>
									onChangeFn({
										...roll,
										drop: roll.drop.map((current, currentIndex) =>
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
							<DropList
								value={candidate.drop}
								onChangeFn={(drop) =>
									drop === undefined
										? removeCandidateFn()
										: onChangeFn({
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
					);
				}}
			</EditorCollectionSelector>
		</div>
	);
};

const RollControl = ({
	onChangeFn,
	value,
}: {
	readonly onChangeFn: (roll: RollSchema.Type | undefined) => void;
	readonly value: RollSchema.Type;
}) => (
	<div className="grid gap-4">
		<EditorChoiceControl
			label="Roll type"
			value={value.type}
			options={[
				{
					description:
						"Emits every configured drop whenever this roll's rules allow it. No probability check is performed.",
					label: "Guaranteed",
					value: "guaranteed",
				},
				{
					description:
						"Performs one probability check from 0% to 100% and emits every configured drop only when that check succeeds.",
					label: "Chance",
					value: "chance",
				},
				{
					description:
						"Makes the configured number of independent selections. Each selection chooses one candidate by relative weight, and candidates may repeat.",
					label: "Weighted",
					value: "weight",
				},
			]}
			onChangeFn={(type) => onChangeFn(structuredClone(DraftDefaults.rolls[type]))}
		/>
		{match(value)
			.with(
				{
					type: "guaranteed",
				},
				(roll) => (
					<DropList
						value={roll.drop}
						onChangeFn={(drop) =>
							drop === undefined
								? onChangeFn(undefined)
								: onChangeFn({
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
							description="Probability that this roll emits its configured drops. The editor converts the percentage to the engine's internal 0–1 value."
							label="Chance (%)"
							value={readChancePercentFn(roll.chance)}
							min={0}
							max={100}
							step={0.01}
							onChangeFn={(chancePercent) =>
								onChangeFn({
									...roll,
									chance: chancePercent / 100,
								})
							}
						/>
						<DropList
							value={roll.drop}
							onChangeFn={(drop) =>
								drop === undefined
									? onChangeFn(undefined)
									: onChangeFn({
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
					<WeightedRollControl
						roll={roll}
						onChangeFn={onChangeFn}
					/>
				),
			)
			.exhaustive()}
	</div>
);

export const RollSetControl = ({
	index,
	onChangeFn,
	value,
}: {
	readonly index: number;
	readonly onChangeFn: (set: RollSetSchema.Type | undefined) => void;
	readonly value: RollSetSchema.Type;
}) => {
	const readItemLabelFn = useEditorItemOptionLabel();
	return (
		<section className="grid gap-3">
			<EditorNumberControl
				label="Relative set weight"
				value={value.weight}
				min={1}
				onChangeFn={(weight) =>
					onChangeFn({
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
				itemLabelFn={(rollIndex) => {
					const roll = value.roll[rollIndex];
					const itemId = readFirstRollItemIdFn(roll);
					return `${roll.type} roll ${rollIndex + 1} — ${readItemLabelFn(
						itemId ?? "",
						"No item selected",
					)}`;
				}}
				label={`Output set ${index + 1} rolls`}
				onAddFn={() =>
					onChangeFn({
						...value,
						roll: [
							...value.roll,
							structuredClone(DraftDefaults.rolls.guaranteed),
						],
					})
				}
				onRemoveFn={(rollIndex) =>
					value.roll.length === 1
						? onChangeFn(undefined)
						: onChangeFn({
								...value,
								roll: value.roll.filter(
									(_current, currentIndex) => currentIndex !== rollIndex,
								) as typeof value.roll,
							})
				}
				removeLabel="Remove roll"
			>
				{(rollIndex) => (
					<RollControl
						value={value.roll[rollIndex]}
						onChangeFn={(next) =>
							next === undefined
								? value.roll.length === 1
									? onChangeFn(undefined)
									: onChangeFn({
											...value,
											roll: value.roll.filter(
												(_current, currentIndex) =>
													currentIndex !== rollIndex,
											) as typeof value.roll,
										})
								: onChangeFn({
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
