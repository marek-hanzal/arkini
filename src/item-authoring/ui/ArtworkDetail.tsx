import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { DetailSection } from "~/item-authoring/ui/DetailDefinition";
import { ArtworkTilePreview } from "~/item-authoring/ui/ArtworkTilePreview";
import { EditorAssetDetailLink } from "~/asset-authoring/ui/EditorAssetDetailLink";

/** Presents artwork layers in authored composition order. */
export const ArtworkDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	return (
		<div className="grid gap-6">
			<DetailSection
				description={`Base tile scale: ${item.asset.scale}. The frame marks the complete tile; artwork is composed back to front.`}
				title="Default artwork"
			>
				<div className="flex items-center gap-5">
					<ArtworkTilePreview
						resourceIds={item.asset.default}
						scale={item.asset.scale}
					/>
					<ol className="grid gap-1 text-sm">
						{item.asset.default.map((resourceId, index) => (
							<li key={resourceId}>
								<EditorAssetDetailLink
									className="font-mono text-sm"
									resourceId={resourceId}
								>
									{index + 1}. {resourceId}
								</EditorAssetDetailLink>
							</li>
						))}
					</ol>
				</div>
			</DetailSection>
		</div>
	);
};
