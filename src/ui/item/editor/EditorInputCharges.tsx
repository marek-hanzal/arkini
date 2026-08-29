import { BatteryMedium, Trash2 } from "lucide-react";

import type { InputSchema as LineInputSchema } from "~/engine/input/schema/InputSchema";
import { Button } from "~/ui/button/Button";
import { EditorCapabilityStatus } from "~/ui/form/EditorCapabilityStatus";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { EditorChoiceControl, EditorNumberControl } from "~/ui/form/EditorValueControls";
import { Tooltip } from "~/ui/overlay/Tooltip";

export const EditorInputCharges = ({
	input,
	onChange,
}: {
	readonly input: LineInputSchema.Type;
	readonly onChange: (input: LineInputSchema.Type) => void;
}) => {
	const charges = input.charges;
	return (
		<div className="grid gap-3">
			<EditorFormSectionDivider
				description="Optional charge payment when this input requirement settles."
				title="Charge cost"
				variant="secondary"
			/>
			{charges === undefined ? (
				<EditorCapabilityStatus
					actionLabel="Enable charge cost"
					description="This input currently settles without spending charges. Enable a cost to charge its owner or selected target when the action starts."
					icon={BatteryMedium}
					onEnable={() =>
						onChange({
							...input,
							charges: {
								cost: 1,
								from: "self",
							},
						})
					}
					title="Charge cost is disabled"
				/>
			) : (
				<div className="grid items-end gap-3 sm:grid-cols-2">
					<EditorChoiceControl
						label="Paid by"
						value={charges.from}
						options={[
							{
								description:
									"The item that owns this action pays the charge cost. It must define enough available charges.",
								label: "Self",
								value: "self",
							},
							{
								description:
									"The board item resolved by a Deposit input pays the charge cost in place. Only Deposit inputs may charge their target.",
								label: "Target",
								value: "target",
							},
						]}
						onChange={(from) =>
							onChange({
								...input,
								charges: {
									...charges,
									from,
								},
							})
						}
					/>
					<div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
						<EditorNumberControl
							label="Cost"
							value={charges.cost}
							min={1}
							onChange={(cost) =>
								onChange({
									...input,
									charges: {
										...charges,
										cost,
									},
								})
							}
						/>
						<Tooltip content="Disable charge cost">
							<Button
								className="size-[var(--ak-control-min-height)] shrink-0 border-0 bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised active:bg-surface-raised"
								data-ui="EditorInputChargeDisableButton"
								onClick={() =>
									onChange({
										...input,
										charges: undefined,
									})
								}
							>
								<Trash2 className="size-4" />
							</Button>
						</Tooltip>
					</div>
				</div>
			)}
		</div>
	);
};
