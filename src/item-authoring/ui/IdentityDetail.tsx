import { EditorMusicSelection } from "~/music-authoring/ui/EditorMusicSelection";
import { ItemEstimateSection } from "~/estimate/ui/ItemEstimateSection";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Fact, FactList } from "~/ui/ui/FactList";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { ProductionSummaryDetail } from "~/item-authoring/ui/ProductionSummaryDetail";
import { ClockDetail } from "~/item-authoring/ui/ClockDetail";
import { ArtworkDetail } from "~/item-authoring/ui/ArtworkDetail";
import { ActionDetail } from "~/item-authoring/ui/ActionDetail";
import { MergesDetail, UnitsDetail } from "~/item-authoring/ui/CapabilityDetails";
import { ItemDetailSectionHeader } from "~/item-authoring/ui/ItemDetailSectionHeader";
import { DetailFact } from "~/item-authoring/ui/DetailDefinition";
import { ConnectionsSummaryDetail } from "~/item-authoring/ui/ConnectionsSummaryDetail";
import { Mx } from "~/translation/ui/Mx";

/** Presents the authored identity and storage contract of one item. */
export const IdentityDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	return (
		<div className="grid gap-[var(--ak-viewport-gap)] min-[64rem]:grid-cols-2">
			<section
				className="grid min-w-0 grid-rows-[auto_1fr] gap-3"
				data-ui="EditorItemArtworkDetail"
			>
				<ItemDetailSectionHeader
					itemUid={item.uid}
					sectionId="artwork"
					title={translator.textFn("Artwork")}
					description={<Mx label="Authored artwork summary help" />}
				/>
				<EditorRootCard
					className="content-start"
					dataUi="EditorItemArtworkDetailCard"
				>
					<ArtworkDetail item={item} />
				</EditorRootCard>
			</section>
			<section
				className="grid min-w-0 grid-rows-[auto_1fr] gap-3"
				data-ui="EditorItemIdentityDetail"
			>
				<ItemDetailSectionHeader
					itemUid={item.uid}
					sectionId="identity"
					title={translator.textFn("Item")}
				/>
				<EditorRootCard dataUi="EditorItemDetailCard">
					<div className="grid content-start gap-5">
						<FactList>
							<DetailFact
								label={translator.textFn("Player controls")}
								description={<Mx label="Authored player controls summary help" />}
								value={translator.textFn(
									item.control === "automatic-only"
										? "Automatic only"
										: "Interactive",
								)}
							/>
							<DetailFact
								label={translator.textFn("Queue capacity")}
								description={<Mx label="Authored queue capacity summary help" />}
								value={item.maxQueueSize}
							/>
							<Fact
								label={translator.textFn("Storage")}
								value={translator.textFn(`Item storage scope - ${item.scope}`)}
							/>
							<Fact
								label={translator.textFn("Stack capacity")}
								value={
									item.maxStackSize === 1
										? translator.textFn("Single item")
										: item.maxStackSize
								}
							/>
							<Fact
								label={translator.textFn("Game limit")}
								value={
									item.maxCount === undefined
										? translator.textFn("Unlimited")
										: item.maxCount
								}
							/>
						</FactList>
						<EditorMusicSelection resourceId={item.music} />
						{item.description === undefined ? null : (
							<FactList columns={1}>
								<Fact
									label={translator.textFn("Description")}
									value={item.description}
								/>
							</FactList>
						)}
					</div>
				</EditorRootCard>
			</section>
			<section
				className="grid min-w-0 grid-rows-[auto_1fr] gap-3"
				data-ui="EditorItemMergesDetail"
			>
				<ItemDetailSectionHeader
					itemUid={item.uid}
					sectionId="merges"
					title={translator.textFn("Merges")}
					description={<Mx label="Authored merges summary help" />}
				/>
				<MergesDetail item={item} />
			</section>
			<section
				className="grid min-w-0 grid-rows-[auto_1fr] gap-3"
				data-ui="EditorItemProductionSummary"
			>
				<ItemDetailSectionHeader
					itemUid={item.uid}
					sectionId="production"
					title={translator.textFn("Production")}
					description={<Mx label="Authored production summary help" />}
				/>
				<ProductionSummaryDetail item={item} />
			</section>
			<section
				className="grid min-w-0 grid-rows-[auto_1fr] gap-3"
				data-ui="EditorItemUnitsDetail"
			>
				<ItemDetailSectionHeader
					itemUid={item.uid}
					sectionId="units"
					title={translator.textFn("Units")}
					description={<Mx label="Authored Units summary help" />}
				/>
				<UnitsDetail
					item={item}
					preview
				/>
			</section>
			<section
				className="grid min-w-0 grid-rows-[auto_1fr] gap-3"
				data-ui="EditorItemClockDetail"
			>
				<ItemDetailSectionHeader
					itemUid={item.uid}
					sectionId="clock"
					title={translator.textFn("Clock")}
					description={<Mx label="Authored Clock summary help" />}
				/>
				<ClockDetail
					item={item}
					preview
				/>
			</section>
			<section
				className="grid min-w-0 grid-rows-[auto_1fr] gap-3"
				data-ui="EditorItemActionDetail"
			>
				<ItemDetailSectionHeader
					itemUid={item.uid}
					sectionId="action"
					title={translator.textFn("Action")}
					description={<Mx label="Authored action summary help" />}
				/>
				<ActionDetail
					item={item}
					preview
				/>
			</section>
			<section
				className="grid min-w-0 grid-rows-[auto_1fr] gap-3"
				data-ui="EditorItemEstimateDetail"
			>
				<ItemDetailSectionHeader
					itemUid={item.uid}
					sectionId="estimate"
					title={translator.textFn("Estimate")}
				/>
				<ItemEstimateSection
					itemId={item.id}
					previewItemUid={item.uid}
				/>
			</section>
			<ConnectionsSummaryDetail item={item} />
		</div>
	);
};
