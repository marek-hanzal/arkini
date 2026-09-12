import { useTranslator } from "~/translation/ui/useTranslator";
import { BatteryCharging, PackagePlus } from "lucide-react";

import { EditorCapabilityDisable } from "~/editor-control/ui/EditorCapabilityDisable";
import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { OptionalOutputControl } from "~/production-authoring/ui/OptionalOutputControl";

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
								icon={BatteryCharging}
								onEnableFn={() =>
									form.setFieldValue("units", {
										amount: 1,
									})
								}
								title={translator.textFn("Item units empty title")}
							/>
						</EditorFormCard>
					) : (
						<>
							<EditorFormCard>
								<form.AppField name="units.amount">
									{(field) => (
										<field.NumberField
											label={translator.textFn("Initial units")}
											description={translator.textFn(
												"The finite supply held by each new item, independently of its stack quantity.",
											)}
											min={1}
										/>
									)}
								</form.AppField>
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
									emptyTitle={translator.textFn(
										"Item depletion output empty title",
									)}
									value={units.output}
									onChangeFn={(output) =>
										form.setFieldValue("units.output", output)
									}
								/>
							</EditorFormCard>
							<EditorCapabilityDisable
								title={translator.textFn("Units configured")}
								description={translator.textFn(
									"Disable removes the unit supply and depletion output from this item.",
								)}
								onDisableFn={() => form.setFieldValue("units", undefined)}
							/>
						</>
					)
				}
			</form.Subscribe>
		</div>
	);
};
