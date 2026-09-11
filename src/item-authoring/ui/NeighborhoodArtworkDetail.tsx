import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorAssetDetailLink } from "~/asset-authoring/ui/EditorAssetDetailLink";
import { DetailSection } from "~/item-authoring/ui/DetailDefinition";
import { NeighborhoodArtworkBoard } from "~/item-authoring/ui/NeighborhoodArtworkBoard";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

/** Presents the authored neighborhood priority and each rule's complete matching pattern. */
export const NeighborhoodArtworkDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const { config } = useEditorProject();
	const rules = item.asset.neighbors ?? [];
	return (
		<DetailSection
			title="Neighbors"
			description="First matching rule wins, using neighbors in the same board layer."
		>
			{rules.length === 0 ? (
				<p className="text-sm text-muted">
					No neighborhood rules. The item uses its default or progress artwork.
				</p>
			) : (
				<ol className="grid gap-5">
					{rules.map((rule, index) => (
						<li
							key={index}
							className="grid gap-2"
						>
							<EditorAssetDetailLink
								className="font-mono text-sm"
								resourceId={rule.sourceId}
							>
								{index + 1}. {rule.sourceId}
							</EditorAssetDetailLink>
							<NeighborhoodArtworkBoard
								rule={rule}
								scale={item.asset.scale}
								items={config.items}
							/>
						</li>
					))}
				</ol>
			)}
		</DetailSection>
	);
};
