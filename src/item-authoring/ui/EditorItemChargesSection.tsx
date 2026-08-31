import { BatteryCharging, PackagePlus, Trash2 } from "lucide-react";

import { Button } from "~/ui/ui/Button";
import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { useEditorItemFormSession } from "~/item-authoring/ui/EditorItemFormContext";
import { EditorOptionalOutputControl } from "~/production-line-authoring/ui/EditorOptionalOutputControl";
import { Tooltip } from "~/ui/ui/Tooltip";

export const EditorItemChargesSection = () => {
	const { form } = useEditorItemFormSession();
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<form.Subscribe selector={(state) => state.values.charges}>
				{(charges) =>
					charges === undefined ? (
						<EditorFormCard>
							<EditorCapabilityStatus
								actionLabel="Enable charges"
								dataUi="EditorChargesDisabled"
								description="Charges give this item a finite number of uses. Configured interactions spend them; reaching zero depletes the item and may emit an output."
								icon={BatteryCharging}
								onEnable={() =>
									form.setFieldValue("charges", {
										amount: 1,
									})
								}
								title="Charges are disabled"
							/>
						</EditorFormCard>
					) : (
						<>
							<EditorFormCard>
								<EditorFormSectionDivider
									description="The finite number of uses available before this item is depleted."
									title="Charge settings"
									variant="secondary"
								/>
								<div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
									<div className="min-w-0">
										<form.AppField name="charges.amount">
											{(field) => (
												<field.NumberField
													label="Initial charges"
													min={1}
												/>
											)}
										</form.AppField>
									</div>
									<Tooltip content="Disable charges">
										<Button
											className="size-[var(--ak-control-min-height)] shrink-0 border-0 bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised active:bg-surface-raised"
											data-ui="EditorItemChargesDisableButton"
											onClick={() => form.setFieldValue("charges", undefined)}
										>
											<Trash2 className="size-4" />
										</Button>
									</Tooltip>
								</div>
							</EditorFormCard>
							<EditorFormSectionDivider
								description="Optional items emitted when the final charge is spent."
								title="Depletion output"
							/>
							<EditorFormCard>
								<EditorOptionalOutputControl
									addLabel="Enable depletion output"
									emptyDescription="Without an output, the item simply disappears when its last charge is spent. Enable one to emit configured items at depletion."
									emptyIcon={PackagePlus}
									emptyTitle="No depletion output"
									value={charges.output}
									onChange={(output) =>
										form.setFieldValue("charges.output", output)
									}
								/>
							</EditorFormCard>
						</>
					)
				}
			</form.Subscribe>
		</div>
	);
};
