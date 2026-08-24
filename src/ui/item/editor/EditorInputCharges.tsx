import type { EditorInput } from "~/bridge/item/editor/EditorItemModel";
import { Button } from "~/ui/button/Button";
import { EditorCapabilityStatus } from "~/ui/form/EditorCapabilityStatus";
import { editorCollectionActionClassName } from "~/ui/form/EditorCollectionSelector";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { EditorChoiceControl, EditorNumberControl } from "~/ui/form/EditorValueControls";
import { Tooltip } from "~/ui/overlay/Tooltip";

export const EditorInputCharges = ({
	input,
	onChange,
}: {
	readonly input: EditorInput;
	readonly onChange: (input: EditorInput) => void;
}) => {
	const charges = input.charges;
	return (
		<div className="grid gap-3">
			<EditorFormSectionDivider
				description="Optional charge payment when this input starts a job."
				title="Charge cost"
				variant="secondary"
			/>
			{charges === undefined ? (
				<EditorCapabilityStatus
					actionLabel="Enable charge cost"
					description="This input currently starts jobs without spending charges. Enable a cost to charge this item or its selected target when the job starts."
					icon="icon-[lucide--battery-medium]"
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
									"The item that owns and runs this production line pays the charge cost. It must define enough available charges.",
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
								className={editorCollectionActionClassName}
								data-ui="EditorInputChargeDisableButton"
								onClick={() =>
									onChange({
										...input,
										charges: undefined,
									})
								}
							>
								<span className="icon-[lucide--trash-2] size-4" />
							</Button>
						</Tooltip>
					</div>
				</div>
			)}
		</div>
	);
};
