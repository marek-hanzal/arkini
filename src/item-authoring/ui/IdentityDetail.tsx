import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { TypePresentation } from "~/item-definition/ui/TypePresentation";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Fact, FactList } from "~/ui/ui/FactList";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { ItemOverview } from "~/item-authoring/ui/ItemOverview";

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
							label={translator.textFn("Type")}
							value={<TypePresentation type={item.type} />}
						/>
						<Fact
							label={translator.textFn("Storage")}
							value={
								item.type === "inventory"
									? translator.textFn("Item storage scope - inventory-control")
									: translator.textFn(`Item storage scope - ${item.scope}`)
							}
						/>
						<Fact
							label={translator.textFn("Stack capacity")}
							value={
								item.maxStackSize === 1
									? "Single item"
									: `${item.maxStackSize} items`
							}
						/>
						<Fact
							label={translator.textFn("Game limit")}
							value={
								item.maxCount === undefined ? "No configured limit" : item.maxCount
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
					<FactList columns={1}>
						<Fact
							label={translator.textFn("Description")}
							value={item.description || "No player-facing description."}
						/>
					</FactList>
				</div>
			</EditorRootCard>
			<ItemOverview item={item} />
		</div>
	);
};
