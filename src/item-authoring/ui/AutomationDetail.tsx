import { Workflow } from "lucide-react";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ProductionDetail } from "~/item-authoring/ui/ProductionDetail";
import { LineTriggerEnumSchema } from "~/production-line/schema/LineTriggerEnumSchema";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Status } from "~/ui/ui/Status";

/** Presents automatic production lines independently of their triggers. */
export const AutomationDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	const hasAutomaticLines = item.lines.some(
		(line) => line.trigger !== LineTriggerEnumSchema.enum.manual,
	);
	const hasTrigger =
		item.units !== undefined ||
		item.clock?.durationMs !== undefined ||
		item.clock?.intervalMs !== undefined;
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
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
					title={translator.textFn(
						hasTrigger
							? "No automation lines defined"
							: "Configure Clock or Units to add automation lines",
					)}
					variant="flat"
				/>
			)}
		</div>
	);
};
