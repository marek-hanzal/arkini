import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { DetailFact } from "~/item-authoring/ui/DetailDefinition";
import { useTranslator } from "~/translation/ui/useTranslator";
import { ArtworkTilePreview } from "~/item-authoring/ui/ArtworkTilePreview";
import { EditorAssetDetailLink } from "~/asset-authoring/ui/EditorAssetDetailLink";

/** Presents artwork layers in authored composition order. */
export const ArtworkDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	return (
		<div className="flex min-w-0 items-start gap-5">
			<ArtworkTilePreview
				resourceIds={item.asset.default}
				scale={item.asset.scale}
			/>
			<dl className="grid min-w-0 gap-4">
				{item.asset.default.map((resourceId, index) => (
					<DetailFact
						key={resourceId}
						label={translator.textFn(index === 0 ? "Base asset" : "Overlay asset")}
						value={
							<EditorAssetDetailLink
								className="font-mono text-sm"
								resourceId={resourceId}
							>
								{resourceId}
							</EditorAssetDetailLink>
						}
					/>
				))}
			</dl>
		</div>
	);
};
