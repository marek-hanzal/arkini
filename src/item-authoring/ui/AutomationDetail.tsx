import { Workflow } from "lucide-react";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ProductionDetail } from "~/item-authoring/ui/ProductionDetail";
import { LineTriggerEnumSchema } from "~/production-line/schema/LineTriggerEnumSchema";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Status } from "~/ui/ui/Status";
import { ClockDetail } from "~/item-authoring/ui/ClockDetail";

/** Presents interval and item-ending jobs from their single authoring tab. */
export const AutomationDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	const hasAutomaticLines = item.lines.some(
		(line) => line.trigger !== LineTriggerEnumSchema.enum.manual,
	);
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<ClockDetail item={item} />
			{hasAutomaticLines ? (
				<ProductionDetail
					item={item}
					kind="automation"
				/>
			) : (
				<Status
					dataUi="EditorItemNoAutomationLines"
					icon={Workflow}
					size="large"
					title={translator.textFn("No automation lines defined")}
					variant="flat"
				/>
			)}
		</div>
	);
};
