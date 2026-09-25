import { EditorMusicSelection } from "~/music-authoring/ui/EditorMusicSelection";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useTranslator } from "~/translation/ui/useTranslator";
import { CopyButton } from "~/ui/ui/CopyButton";
import { Fact, FactList } from "~/ui/ui/FactList";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { ProductionSummaryDetail } from "~/item-authoring/ui/ProductionSummaryDetail";
import { ArtworkDetail } from "~/item-authoring/ui/ArtworkDetail";
import { MergesDetail } from "~/item-authoring/ui/CapabilityDetails";
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
				data-ui="EditorItemUidentityDetail"
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
								label={translator.textFn("Item interface")}
								description={<Mx label="Item interface help" />}
								value={translator.textFn(
									item.ui === "simple" ? "Simple" : "Default",
								)}
							/>
							<DetailFact
								label={translator.textFn("Queue capacity")}
								description={<Mx label="Authored queue capacity summary help" />}
								value={item.maxQueueSize}
							/>
							<DetailFact
								label={translator.textFn("Units")}
								description={<Mx label="Authored Units amount summary help" />}
								value={item.units?.amount ?? translator.textFn("None")}
							/>
							<DetailFact
								label={translator.textFn("Termination mode")}
								value={translator.textFn(
									item.terminationMode === "kill-switch"
										? "Kill switch"
										: "Loose-kill",
								)}
							/>
						</FactList>
						<div className="grid min-w-0 grid-cols-2 items-start gap-x-8">
							<EditorMusicSelection resourceUid={item.music} />
							<FactList columns={1}>
								<Fact
									label={translator.textFn("Item UID")}
									mono
									value={
										<div className="flex items-center gap-2">
											<span className="min-w-0">{item.uid}</span>
											<CopyButton value={item.uid} />
										</div>
									}
								/>
							</FactList>
						</div>
						{item.description === undefined ? null : (
							<FactList columns={1}>
								<Fact
									label={translator.textFn("Description")}
									value={item.description}
								/>
							</FactList>
						)}
						{item.keywords === undefined ? null : (
							<FactList columns={1}>
								<Fact
									label={translator.textFn("Keywords")}
									value={item.keywords}
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
			<ConnectionsSummaryDetail item={item} />
		</div>
	);
};
