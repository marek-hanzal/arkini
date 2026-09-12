import { Factory } from "lucide-react";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ProductionLineDetail } from "~/item-authoring/ui/ProductionLineDetail";
import { DisabledCapabilityDetail } from "~/item-authoring/ui/DisabledCapabilityDetail";
import { ItemDetailSectionHeader } from "~/item-authoring/ui/ItemDetailSectionHeader";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Presents the authored production lines and their input/output flows. */
export const ProductionDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	return (
		<div
			className="grid gap-[var(--ak-viewport-gap)]"
			data-ui="EditorItemProductionDetail"
		>
			<ItemDetailSectionHeader
				itemUid={item.uid}
				sectionId="production"
				title={translator.textFn("Production lines")}
				description={translator.textFn(
					"Each line owns its inputs, outputs, runtime and rules. Manual and Clock requests share the same queue.",
				)}
			/>
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
						title={translator.textFn("Item production empty title")}
						actionLabel={translator.textFn("Enable")}
						icon={Factory}
					/>
				</EditorRootCard>
			)}
		</div>
	);
};
