import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { EditorFormCard } from "~/ui/form/EditorFormCard";
import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";
import { EditorItemArtworkTimeline } from "~/item-authoring/ui/EditorItemArtworkTimeline";

interface EditorItemArtworkPreviewProps {
	readonly asset: ItemSchema.Type["asset"];
	readonly onSelectProgress: (index: number) => void;
	readonly selectedProgressIndex: number;
}

/** Mirrors the engine's evenly distributed progress-artwork projection. */
export const EditorItemArtworkPreview = ({
	asset,
	onSelectProgress,
	selectedProgressIndex,
}: EditorItemArtworkPreviewProps) => {
	return (
		<EditorFormCard>
			<header className="flex items-center gap-1">
				<h2 className="text-base font-semibold">Artwork progression</h2>
				<EditorInfoTooltip content="The default composition starts at 0%. Progress assets replace the complete composition at the evenly distributed thresholds shown below, matching the runtime engine." />
			</header>
			<EditorItemArtworkTimeline
				asset={asset}
				onSelectProgress={onSelectProgress}
				selectedProgressIndex={selectedProgressIndex}
			/>
		</EditorFormCard>
	);
};
