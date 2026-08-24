import { match } from "ts-pattern";

import type { EditorRoll } from "~/bridge/item/editor/EditorItemModel";
import { EditorChoiceControl, EditorNumberControl } from "~/ui/form/EditorValueControls";
import { EditorDropList } from "~/ui/item/editor/EditorDropList";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorWeightedRollControl } from "~/ui/item/editor/EditorWeightedRollControl";

const readChancePercent = (chance: number) => Number((chance * 100).toFixed(6));

export const EditorRollControl = ({
	onChange,
	value,
}: {
	readonly onChange: (roll: EditorRoll | undefined) => void;
	readonly value: EditorRoll;
}) => {
	return (
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
								description="Probability that this roll emits its configured drops. The editor converts the percentage to the engine's internal 0–1 value."
								label="Chance (%)"
								value={readChancePercent(roll.chance)}
								min={0}
								max={100}
								step={0.01}
								onChange={(chancePercent) =>
									onChange({
										...roll,
										chance: chancePercent / 100,
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
						<EditorWeightedRollControl
							roll={roll}
							onChange={onChange}
						/>
					),
				)
				.exhaustive()}
		</div>
	);
};
