import type { EditorInput } from "~/bridge/item/editor/EditorItemModel";
import { Button } from "~/ui/button/Button";
import { EditorCapabilityStatus } from "~/ui/form/EditorCapabilityStatus";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { EditorChoiceControl, EditorNumberControl } from "~/ui/form/EditorValueControls";

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
				<>
					<div className="flex items-center justify-end gap-3">
						<Button
							onClick={() =>
								onChange({
									...input,
									charges: undefined,
								})
							}
						>
							Disable charge cost
						</Button>
					</div>
					<div className="grid gap-3 sm:grid-cols-2">
						<EditorNumberControl
							label="Charge cost"
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
						<EditorChoiceControl
							label="Paid by"
							value={charges.from}
							options={[
								{
									label: "Self",
									value: "self",
								},
								{
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
					</div>
				</>
			)}
		</div>
	);
};
