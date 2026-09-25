import { useStore } from "@tanstack/react-form";
import { Workflow } from "lucide-react";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { ProductionLinesSection } from "~/item-authoring/ui/ProductionLinesSection";
import { LineTriggerEnumSchema } from "~/production-line/schema/LineTriggerEnumSchema";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Status } from "~/ui/ui/Status";

/** Authors automatic production lines when the item has a usable trigger. */
export const AutomationSection = () => {
	const { form } = useFormSession();
	const translator = useTranslator();
	const hasTriggerOrLines = useStore(
		form.store,
		(state) =>
			state.values.units !== undefined ||
			state.values.clock?.durationMs !== undefined ||
			state.values.clock?.intervalMs !== undefined ||
			(state.values.lines ?? []).some(
				(line) => line.trigger !== LineTriggerEnumSchema.enum.manual,
			),
	);
	return hasTriggerOrLines ? (
		<ProductionLinesSection kind="automation" />
	) : (
		<Status
			dataUi="EditorAutomationUnavailable"
			icon={Workflow}
			size="large"
			title={translator.textFn("Configure Clock or Units to add automation lines")}
			variant="flat"
		/>
	);
};
