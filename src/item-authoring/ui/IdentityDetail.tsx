import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Fact, FactList } from "~/ui/ui/FactList";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { ArtworkDetail } from "~/item-authoring/ui/ArtworkDetail";
import { UnitsDetail } from "~/item-authoring/ui/CapabilityDetails";
import { ItemDetailSectionHeader } from "~/item-authoring/ui/ItemDetailSectionHeader";
import { DetailFact } from "~/item-authoring/ui/DetailDefinition";

/** Presents the authored identity and storage contract of one item. */
export const IdentityDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	return (
		<div className="grid gap-[var(--ak-viewport-gap)]">
			<EditorRootCard dataUi="EditorItemDetailCard">
				<div className="grid gap-x-8 gap-y-5 min-[64rem]:grid-cols-[auto_minmax(0,2fr)_minmax(0,1fr)]">
					<EditorItemThumbnail
						resourceIds={item.asset.default}
						size="xl"
					/>
					<FactList>
						<DetailFact
							label={translator.textFn("Player controls")}
							description={translator.textFn(
								"Player controls govern manual production, material management, queue changes and line selection.",
							)}
							value={translator.textFn(
								item.control === "automatic-only"
									? "Automatic only"
									: "Interactive",
							)}
						/>
						<DetailFact
							label={translator.textFn("Queue capacity")}
							description={translator.textFn(
								"Maximum accepted work count across this item’s production lines: one active job plus queued requests.",
							)}
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
									? translator.textFn("No configured limit")
									: item.maxCount
							}
						/>
						<Fact
							label={translator.textFn("Item ID")}
							mono
							value={item.id}
						/>
						<Fact
							label={translator.textFn("UID")}
							mono
							value={item.uid}
						/>
					</FactList>
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
			<div className="grid gap-[var(--ak-viewport-gap)] min-[64rem]:grid-cols-2">
				<section
					className="grid min-w-0 grid-rows-[auto_1fr] gap-[var(--ak-viewport-gap)]"
					data-ui="EditorItemArtworkDetail"
				>
					<ItemDetailSectionHeader
						itemUid={item.uid}
						sectionId="artwork"
						title={translator.textFn("Artwork")}
						description={translator.textFn(
							"Base and overlay assets share one tile scale. Artwork does not change occupied cells.",
						)}
					/>
					<EditorRootCard
						className="content-start"
						dataUi="EditorItemArtworkDetailCard"
					>
						<ArtworkDetail item={item} />
					</EditorRootCard>
				</section>
				<section
					className="grid min-w-0 grid-rows-[auto_1fr] gap-[var(--ak-viewport-gap)]"
					data-ui="EditorItemUnitsDetail"
				>
					<ItemDetailSectionHeader
						itemUid={item.uid}
						sectionId="units"
						title={translator.textFn("Units")}
						description={translator.textFn(
							"Units are the supply inside each item, independently of how many items are stacked.",
						)}
					/>
					<UnitsDetail item={item} />
				</section>
			</div>
		</div>
	);
};
