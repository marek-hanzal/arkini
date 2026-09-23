import { useTranslator } from "~/translation/ui/useTranslator";
import { BatteryCharging } from "lucide-react";

import { EditorCapabilityStatus } from "~/editor-control/ui/EditorCapabilityStatus";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { SectionEnd } from "~/ui/ui/SectionEnd";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { OutcomeControl } from "~/production-authoring/ui/OutcomeControl";
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
								<EditorFormSectionDivider title={translator.textFn("Units")} />
								<form.AppField name="units.amount">
									{(field) => (
										<field.NumberField
											label={translator.textFn("Initial units")}
											description={<Mx label="Initial units help" />}
											min={1}
										/>
									)}
								</form.AppField>
								<SectionEnd />
							</EditorFormCard>
							<EditorFormSection
								description={<Mx label="Depletion outcome help" />}
								title={translator.textFn("Depletion outcome")}
							>
								<EditorFormCard>
									<OutcomeControl
										value={units.outcome}
										onChangeFn={(outcome) =>
											form.setFieldValue("units.outcome", outcome)
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
