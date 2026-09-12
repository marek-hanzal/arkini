import { useTranslator } from "~/translation/ui/useTranslator";
import { BatteryCharging, PackagePlus, Trash2 } from "lucide-react";

import { Button } from "~/ui/ui/Button";
import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { OptionalOutputControl } from "~/production-authoring/ui/OptionalOutputControl";
import { Tooltip } from "~/ui/ui/Tooltip";

export const UnitsSection = () => {
	const translator = useTranslator();
	const { form } = useFormSession();
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<form.Subscribe selector={(state) => state.values.units}>
				{(units) =>
					units === undefined ? (
						<EditorFormCard>
							<EditorCapabilityStatus
								actionLabel={translator.textFn("Enable units")}
								dataUi="EditorUnitsDisabled"
								description={translator.textFn(
									"Units are a finite amount inside one item, such as health, resources, or uses. Spending the last unit depletes the item and may emit an output.",
								)}
								icon={BatteryCharging}
								onEnableFn={() =>
									form.setFieldValue("units", {
										amount: 1,
									})
								}
								title={translator.textFn("Units are disabled")}
							/>
						</EditorFormCard>
					) : (
						<>
							<EditorFormCard>
								<div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
									<div className="min-w-0">
										<form.AppField name="units.amount">
											{(field) => (
												<field.NumberField
													label={translator.textFn("Initial units")}
													min={1}
												/>
											)}
										</form.AppField>
									</div>
									<Tooltip content={translator.textFn("Disable units")}>
										<Button
											className="size-[var(--ak-control-min-height)] shrink-0 border-0 bg-transparent p-0 shadow-none hover:border-transparent hover:bg-surface-raised active:bg-surface-raised"
											data-ui="EditorItemUnitsDisableButton"
											onClick={() => form.setFieldValue("units", undefined)}
										>
											<Trash2 className="size-4" />
										</Button>
									</Tooltip>
								</div>
							</EditorFormCard>
							<EditorFormSectionDivider
								description={translator.textFn(
									"Optional items emitted when the final unit is spent.",
								)}
								title={translator.textFn("Depletion output")}
							/>
							<EditorFormCard>
								<OptionalOutputControl
									addLabel={translator.textFn("Enable depletion output")}
									emptyDescription={translator.textFn(
										"Without an output, the item simply disappears when its last unit is spent. Enable one to emit configured items at depletion.",
									)}
									emptyIcon={PackagePlus}
									emptyTitle={translator.textFn("No depletion output")}
									value={units.output}
									onChangeFn={(output) =>
										form.setFieldValue("units.output", output)
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
