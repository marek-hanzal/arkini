import { ArrowUpRight, Factory } from "lucide-react";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DisabledCapabilityDetail } from "~/item-authoring/ui/DisabledCapabilityDetail";
import { OutcomeDetail } from "~/item-authoring/ui/OutcomeDetail";
import { useTranslator } from "~/translation/ui/useTranslator";
import { ProductionLineBadges } from "~/production-authoring/ui/ProductionLineBadges";
import { LineEditLink } from "~/production-authoring/ui/LineEditLink";
import { Mx } from "~/translation/ui/Mx";

/** Keeps the item overview to two authored lines, with full outcome semantics. */
export const ProductionSummaryDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	const lines = item.lines.filter((line) => line.trigger === "manual");
	return (
		<div className="grid">
			{lines.length === 0 ? (
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
					{lines.slice(0, 2).map((line) => (
						<EditorRootCard
							key={line.uid}
							dataUi="EditorItemProductionOutputCard"
						>
							<OutcomeDetail
								outcome={line.outcome}
								title={
									<span className="inline-flex flex-wrap items-center gap-2">
										<LineEditLink
											itemUid={item.uid}
											lineUid={line.uid}
										>
											{line.title}
											<ArrowUpRight className="size-4 shrink-0 text-muted transition-colors group-hover:text-accent" />
										</LineEditLink>
										<ProductionLineBadges line={line} />
									</span>
								}
								emptyLabel={translator.textFn("No outcome")}
								description={
									<Mx label="Authored production line outcome summary help" />
								}
							/>
						</EditorRootCard>
					))}
				</div>
			)}
		</div>
	);
};
