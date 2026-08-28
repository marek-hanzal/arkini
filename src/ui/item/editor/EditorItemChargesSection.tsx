import { Button } from "~/ui/button/Button";
import { EditorCapabilityStatus } from "~/ui/form/EditorCapabilityStatus";
import { editorCollectionActionClassName } from "~/ui/form/EditorCollectionSelector";
import { EditorFormCard } from "~/ui/form/EditorFormCard";
import { EditorFormSectionDivider } from "~/ui/form/EditorFormSectionDivider";
import { useEditorItemFormSession } from "~/ui/item/editor/EditorItemFormContext";
import { EditorOptionalOutputControl } from "~/ui/item/editor/EditorOptionalOutputControl";
import { Tooltip } from "~/ui/overlay/Tooltip";

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
								icon="icon-[lucide--battery-charging]"
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
											className={editorCollectionActionClassName}
											data-ui="EditorItemChargesDisableButton"
											onClick={() => form.setFieldValue("charges", undefined)}
										>
											<span className="icon-[lucide--trash-2] size-4" />
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
									emptyIcon="icon-[lucide--package-plus]"
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
