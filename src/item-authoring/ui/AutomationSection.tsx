import { EditorChoiceControl } from "~/editor-control/ui/EditorValueControls";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { ProductionLinesSection } from "~/item-authoring/ui/ProductionLinesSection";
import { Mx } from "~/translation/ui/Mx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { ClockSection } from "~/item-authoring/ui/ClockSection";

/** Authors the shared automatic line collection and its item-ending policy. */
export const AutomationSection = () => {
	const { form } = useFormSession();
	const translator = useTranslator();
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<ClockSection />
			<EditorFormCard>
				<EditorFormSectionDivider title={translator.textFn("Common")} />
				<form.AppField name="terminationMode">
					{(field) => (
						<EditorChoiceControl
							label={translator.textFn("Termination mode")}
							value={field.state.value ?? "loose-kill"}
							options={[
								{
									value: "loose-kill",
									label: translator.textFn("Loose-kill"),
									description: <Mx label="Termination loose-kill help" />,
								},
								{
									value: "kill-switch",
									label: translator.textFn("Kill switch"),
									description: <Mx label="Termination kill-switch help" />,
								},
							]}
							onChangeFn={field.handleChange}
						/>
					)}
				</form.AppField>
			</EditorFormCard>
			<ProductionLinesSection kind="automation" />
		</div>
	);
};
