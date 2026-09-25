import { ProductionLinesSection } from "~/item-authoring/ui/ProductionLinesSection";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorFormSection } from "~/editor-control/ui/EditorFormSection";
import { Mx } from "~/translation/ui/Mx";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Authors manual production capacity and lines; automatic lines live in Automation. */
export const ProductionSection = () => {
	const { form } = useFormSession();
	const translator = useTranslator();
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<EditorFormSection
				description={<Mx label="Production queue capacity help" />}
				required
				title={translator.textFn("Queue capacity")}
			>
				<EditorFormCard>
					<form.AppField name="maxQueueSize">
						{(field) => (
							<field.NumberField
								label={translator.textFn("Queue capacity")}
								labelVisible={false}
								min={1}
							/>
						)}
					</form.AppField>
				</EditorFormCard>
			</EditorFormSection>
			<ProductionLinesSection kind="manual" />
		</div>
	);
};
