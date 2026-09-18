import type { useItemDetailSceneController } from "~/item-detail/ui/useItemDetailSceneController";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Fact, FactList } from "~/ui/ui/FactList";
import { ItemArtwork } from "~/ui/ui/ItemArtwork";

/** The player's basic item facts, without authoring controls or resource identifiers. */
export const ItemInfo = ({ detail }: { readonly detail: useItemDetailSceneController.Detail }) => {
	const translator = useTranslator();
	return (
		<section
			className="flex min-h-full items-center justify-center p-6"
			data-ui="ItemInfo"
		>
			<div className="grid w-full max-w-5xl grid-cols-2 items-center gap-12">
				<ItemArtwork
					className="aspect-square size-auto w-full max-w-md justify-self-center"
					sourceUrl={detail.sourceUrl}
					compositeUrl={detail.compositeUrl}
					dataUi="ItemInfoArtwork"
				/>
				<div className="grid min-w-0 gap-8">
					{detail.description ? (
						<p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
							{detail.description}
						</p>
					) : null}
					<FactList columns={1}>
						<Fact
							label={translator.textFn("Where you can keep it")}
							value={
								detail.scope === "any"
									? translator.textFn("Board, inventory and toolbar")
									: translator.textFn(`Item storage scope - ${detail.scope}`)
							}
						/>
						<Fact
							label={translator.textFn("Items per stack")}
							value={
								detail.maxStackSize === 1
									? translator.textFn("Single item")
									: detail.maxStackSize
							}
						/>
						<Fact
							label={translator.textFn("Maximum in the game")}
							value={
								detail.maxCount === undefined
									? translator.textFn("Unlimited")
									: detail.maxCount
							}
						/>
					</FactList>
				</div>
			</div>
		</section>
	);
};
