import { Factory } from "lucide-react";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ProductionLineDetail } from "~/item-authoring/ui/ProductionLineDetail";
import { ClockDetail } from "~/item-authoring/ui/ClockDetail";
import { DisabledCapabilityDetail } from "~/item-authoring/ui/DisabledCapabilityDetail";
import { ItemDetailSectionHeader } from "~/item-authoring/ui/ItemDetailSectionHeader";
import { DetailFact } from "~/item-authoring/ui/DetailDefinition";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Presents shared production settings, scheduling and the authored input/output flows. */
export const ProductionDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	return (
		<div
			className="grid gap-[var(--ak-viewport-gap)]"
			data-ui="EditorItemProductionDetail"
		>
			<ItemDetailSectionHeader
				itemUid={item.uid}
				sectionId="clock"
				title={translator.textFn("Clock")}
				description={translator.textFn(
					"Clock attempts the marked line at each interval and can also limit this item's lifetime. A lifetime works without production lines.",
				)}
			/>
			<ClockDetail item={item} />
			<ItemDetailSectionHeader
				itemUid={item.uid}
				sectionId="production"
				title={translator.textFn("Production lines")}
				description={translator.textFn(
					"Each line owns its inputs, outputs, runtime and rules. Manual and Clock requests share the same queue.",
				)}
			/>
			<EditorRootCard dataUi="EditorProductionQueueSettings">
				<DetailFact
					label={translator.textFn("Queue capacity")}
					description={translator.textFn(
						"Maximum accepted work count across this item’s production lines: one active job plus queued requests.",
					)}
					value={item.maxQueueSize}
				/>
			</EditorRootCard>
			{item.lines.length > 0 ? (
				<div className="ak-list grid gap-3">
					{item.lines.map((line) => (
						<ProductionLineDetail
							itemUid={item.uid}
							key={line.id}
							line={line}
						/>
					))}
				</div>
			) : (
				<EditorRootCard dataUi="EditorProductionDisabledCard">
					<DisabledCapabilityDetail
						capability="production"
						itemUid={item.uid}
						title={translator.textFn("Production lines are disabled")}
						actionLabel={translator.textFn("Enable production")}
						icon={Factory}
						description={translator.textFn(
							"Adding the first line enables production and removes the configured action. Changes take effect when you save.",
						)}
					/>
				</EditorRootCard>
			)}
		</div>
	);
};
