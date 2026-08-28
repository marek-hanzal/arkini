import { Info } from "lucide-react";

import type { EditorRoll } from "~/bridge/item/editor/EditorItemModel";
import { EditorCollectionSelector } from "~/ui/form/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { EditorNumberControl } from "~/ui/form/EditorValueControls";
import { EditorDropList } from "~/ui/item/editor/EditorDropList";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorQuantityFields } from "~/ui/item/editor/EditorQuantityControl";
import { useEditorItemOptionLabel } from "~/ui/item/editor/useEditorItemOptionLabel";
import { Tooltip } from "~/ui/overlay/Tooltip";

type EditorWeightedRoll = Extract<
	EditorRoll,
	{
		readonly type: "weight";
	}
>;

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

/** Edits selections and the non-empty candidate collection of one weighted roll. */
export const EditorWeightedRollControl = ({
	onChange,
	roll,
}: {
	readonly onChange: (roll: EditorRoll | undefined) => void;
	readonly roll: EditorWeightedRoll;
}) => {
	const readItemLabel = useEditorItemOptionLabel();
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
					<EditorQuantityFields
						minimumDescription="Lowest number of independent candidate selections this roll may perform when it resolves."
						maximumDescription="Highest number of independent candidate selections this roll may perform. The actual integer count is chosen from Minimum through Maximum, inclusive."
						value={roll.quantity}
						onChange={(quantity) =>
							onChange({
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
				itemLabel={(candidateIndex) => {
					const itemId = roll.drop[candidateIndex].drop[0]?.itemId;
					return readItemLabel(itemId ?? "", `Candidate ${candidateIndex + 1}`);
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
									(_current, currentIndex) => currentIndex !== candidateIndex,
								) as typeof roll.drop,
							})
				}
				removeLabel="Remove weighted candidate"
			>
				{(candidateIndex) => {
					const candidate = roll.drop[candidateIndex];
					const removeCandidate = () =>
						roll.drop.length <= 2
							? onChange(undefined)
							: onChange({
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
								onChange={(weight) =>
									onChange({
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
							<EditorDropList
								value={candidate.drop}
								onChange={(drop) =>
									drop === undefined
										? removeCandidate()
										: onChange({
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
