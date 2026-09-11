import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { DetailSection } from "~/item-authoring/ui/DetailDefinition";
import { ArtworkTimeline } from "~/item-authoring/ui/ArtworkTimeline";
import { ArtworkTilePreview } from "~/item-authoring/ui/ArtworkTilePreview";
import { EditorAssetDetailLink } from "~/asset-authoring/ui/EditorAssetDetailLink";

/** Presents default and progress artwork in authored composition order. */
export const ArtworkDetail = ({ item }: { readonly item: ItemSchema.Type }) => (
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
		{(item.asset.sources?.length ?? 0) > 0 ? (
			<DetailSection title="Progress artwork">
				<ArtworkTimeline
					asset={item.asset}
					itemType={item.type}
					linkAssets
				/>
			</DetailSection>
		) : null}
	</div>
);
