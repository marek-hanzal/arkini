import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { DetailFact } from "~/item-authoring/ui/DetailDefinition";
import { useTranslator } from "~/translation/ui/useTranslator";
import { ArtworkTilePreview } from "~/item-authoring/ui/ArtworkTilePreview";
import { EditorArtworkDetailLink } from "~/artwork-authoring/ui/EditorArtworkDetailLink";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

/** Presents artwork layers in authored composition order. */
export const ArtworkDetail = ({
	item,
	layout = "summary",
}: {
	readonly item: ItemSchema.Type;
	readonly layout?: "summary" | "detail";
}) => {
	const translator = useTranslator();
	return (
		<div
			className="group/artwork flex min-w-0 flex-wrap items-start gap-5 data-[ui-layout=detail]:flex-col data-[ui-layout=detail]:items-center"
			{...readDataUiFn({
				dataUi: "EditorArtworkDetail",
				state: {
					layout,
				},
			})}
		>
			<ArtworkTilePreview
				className="group-data-[ui-layout=detail]/artwork:aspect-square group-data-[ui-layout=detail]/artwork:size-auto group-data-[ui-layout=detail]/artwork:w-full group-data-[ui-layout=detail]/artwork:max-w-[60dvh] group-data-[ui-layout=detail]/artwork:rounded-2xl group-data-[ui-layout=detail]/artwork:border-2 group-data-[ui-layout=detail]/artwork:border-accent"
				resourceIds={item.artwork.default}
				scale={item.artwork.scale}
			/>
			<dl className="grid min-w-0 gap-4 text-left group-data-[ui-layout=detail]/artwork:order-first">
				{item.artwork.default.map((resourceId, index) => (
					<DetailFact
						key={resourceId}
						label={translator.textFn(index === 0 ? "Base artwork" : "Overlay artwork")}
						value={
							<EditorArtworkDetailLink
								className="font-mono text-sm"
								resourceId={resourceId}
							>
								{resourceId}
							</EditorArtworkDetailLink>
						}
					/>
				))}
			</dl>
		</div>
	);
};
