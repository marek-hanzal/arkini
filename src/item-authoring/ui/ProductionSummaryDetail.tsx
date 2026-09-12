import { ArrowUpRight, Factory } from "lucide-react";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DisabledCapabilityDetail } from "~/item-authoring/ui/DisabledCapabilityDetail";
import { OutputDetail } from "~/item-authoring/ui/OutputDetail";
import { useTranslator } from "~/translation/ui/useTranslator";
import { ProductionLineBadges } from "~/production-authoring/ui/ProductionLineBadges";
import { LineEditLink } from "~/production-authoring/ui/LineEditLink";
import { ItemCollectionMoreCard } from "~/item-authoring/ui/ItemCollectionMoreCard";

/** Keeps the item overview to two authored lines, with full output semantics. */
export const ProductionSummaryDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	return (
		<div className="grid grid-rows-[1fr_auto] gap-3">
			{item.lines.length === 0 ? (
				<EditorRootCard dataUi="EditorItemProductionDisabledCard">
					<DisabledCapabilityDetail
						capability="production"
						itemUid={item.uid}
						title={translator.textFn("Item production empty title")}
						actionLabel={translator.textFn("Enable")}
						icon={Factory}
					/>
				</EditorRootCard>
			) : (
				<div
					className="grid content-start gap-3"
					data-ui="EditorItemProductionSummaryContent"
				>
					{item.lines.slice(0, 2).map((line) => (
						<EditorRootCard
							key={line.id}
							dataUi="EditorItemProductionOutputCard"
						>
							<OutputDetail
								output={line.output}
								title={
									<span className="inline-flex flex-wrap items-center gap-2">
										<LineEditLink
											itemUid={item.uid}
											lineId={line.id}
										>
											{line.title}
											<ArrowUpRight className="size-4 shrink-0 text-muted transition-colors group-hover:text-accent" />
										</LineEditLink>
										<ProductionLineBadges line={line} />
									</span>
								}
								emptyLabel={translator.textFn("No output")}
								description={translator.textFn(
									"This line can complete without producing an item. Configured output is resolved through its alternatives, rolls, and drop rules.",
								)}
							/>
						</EditorRootCard>
					))}
				</div>
			)}
			<ItemCollectionMoreCard
				itemUid={item.uid}
				sectionId="production"
				hasMore={item.lines.length > 2}
			/>
		</div>
	);
};
