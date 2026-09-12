import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Fact, FactList } from "~/ui/ui/FactList";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { ArtworkDetail } from "~/item-authoring/ui/ArtworkDetail";
import { UnitsDetail } from "~/item-authoring/ui/CapabilityDetails";
import { ItemDetailSectionHeader } from "~/item-authoring/ui/ItemDetailSectionHeader";

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
			<ItemDetailSectionHeader
				itemUid={item.uid}
				sectionId="artwork"
				title={translator.textFn("Artwork")}
				description={translator.textFn(
					"Base and overlay assets share one tile scale. Artwork does not change occupied cells.",
				)}
			/>
			<EditorRootCard dataUi="EditorItemArtworkDetailCard">
				<ArtworkDetail item={item} />
			</EditorRootCard>
			<ItemDetailSectionHeader
				itemUid={item.uid}
				sectionId="units"
				title={translator.textFn("Units")}
				description={translator.textFn(
					"Units are the supply inside each item, independently of how many items are stacked.",
				)}
			/>
			<UnitsDetail item={item} />
		</div>
	);
};
