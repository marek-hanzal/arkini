import { useTranslator } from "~/translation/ui/useTranslator";
import { BatteryCharging, PackagePlus } from "lucide-react";

import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
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
						<EditorCapabilityStatus
							actionLabel={translator.textFn("Enable")}
							dataUi="EditorUnitsDisabled"
							icon={BatteryCharging}
							onEnableFn={() =>
								form.setFieldValue("units", {
									amount: 1,
								})
							}
							title={translator.textFn("No Units configured")}
							summary={translator.textFn("Item units empty title")}
							size="large"
						/>
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
							<EditorFormSection
								description={translator.textFn(
									"Optional items emitted when the final unit is spent.",
								)}
								title={translator.textFn("Depletion output")}
							>
								<EditorFormCard>
									<OptionalOutputControl
										addLabel={translator.textFn("Enable")}
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
							</EditorFormSection>
						</>
					)
				}
			</form.Subscribe>
		</div>
	);
};
