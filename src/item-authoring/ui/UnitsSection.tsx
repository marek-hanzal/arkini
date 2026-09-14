import { useTranslator } from "~/translation/ui/useTranslator";
import { BatteryCharging } from "lucide-react";

import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormBranchEnd } from "~/editor-control/ui/EditorFormBranchEnd";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { OutputControl } from "~/production-authoring/ui/OutputControl";
import { Mx } from "~/translation/ui/Mx";

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
											description={<Mx label="Initial units help" />}
											min={1}
										/>
									)}
								</form.AppField>
								<EditorFormBranchEnd />
							</EditorFormCard>
							<EditorFormSection
								description={<Mx label="Depletion output help" />}
								title={translator.textFn("Depletion output")}
							>
								<EditorFormCard>
									<OutputControl
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
