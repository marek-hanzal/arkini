import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { DetailSection } from "~/item-authoring/ui/DetailDefinition";
import { ArtworkTimeline } from "~/item-authoring/ui/ArtworkTimeline";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { EditorAssetDetailLink } from "~/asset-authoring/ui/EditorAssetDetailLink";

/** Presents default and progress artwork in authored composition order. */
export const ArtworkDetail = ({ item }: { readonly item: ItemSchema.Type }) => (
	<div className="grid gap-6">
		<DetailSection
			description="Default composition is shown in authoritative back-to-front order."
			title="Default artwork"
		>
			<div className="flex items-center gap-5">
				<EditorItemThumbnail resourceIds={item.asset.default} />
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
					linkAssets
				/>
			</DetailSection>
		) : null}
	</div>
);
