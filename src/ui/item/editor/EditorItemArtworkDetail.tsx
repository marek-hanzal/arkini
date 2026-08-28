import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { DetailSection } from "~/ui/item/editor/EditorItemDetailDefinition";
import { EditorItemArtworkTimeline } from "~/ui/item/editor/EditorItemArtworkTimeline";
import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import { EditorAssetDetailLink } from "~/ui/resource/editor/EditorAssetDetailLink";

/** Presents default and progress artwork in authored composition order. */
export const EditorItemArtworkDetail = ({ item }: { readonly item: ItemSchema.Type }) => (
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
		<DetailSection title="Progress artwork">
			<EditorItemArtworkTimeline
				asset={item.asset}
				linkAssets
			/>
		</DetailSection>
	</div>
);
