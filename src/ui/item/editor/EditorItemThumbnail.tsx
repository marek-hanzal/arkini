import { ItemArtwork } from "~/ui/item/ItemArtwork";
import { useEditorResourceUrl } from "~/ui/resource/editor/useEditorResourceUrl";

export namespace EditorItemThumbnail {
	export interface Props {
		readonly resourceIds:
			| readonly [
					string,
			  ]
			| readonly [
					string,
					string,
			  ];
	}
}

/** Renders the complete default item composition from back to front. */
export const EditorItemThumbnail = ({ resourceIds }: EditorItemThumbnail.Props) => {
	const backgroundUrl = useEditorResourceUrl(resourceIds[0]);
	const foregroundUrl = useEditorResourceUrl(resourceIds[1]);
	const ready =
		backgroundUrl !== undefined &&
		(resourceIds[1] === undefined || foregroundUrl !== undefined);
	if (ready) {
		return (
			<ItemArtwork
				className="overflow-hidden rounded-xl border border-line bg-canvas/70"
				compositeUrl={foregroundUrl}
				dataUi="EditorItemThumbnail"
				size="lg"
				sourceUrl={backgroundUrl}
			/>
		);
	}
	return (
		<div
			className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-canvas/70"
			data-ui="EditorItemThumbnail"
		>
			<span className="text-xl font-semibold text-subtle">?</span>
		</div>
	);
};
