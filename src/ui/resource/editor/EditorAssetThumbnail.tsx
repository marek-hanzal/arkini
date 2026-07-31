import { useEditorResourceUrl } from "~/ui/resource/editor/useEditorResourceUrl";

export interface EditorAssetThumbnailProps {
	readonly resourceId: string;
}

/** Renders one raw editor asset without applying item-composition semantics. */
export const EditorAssetThumbnail = ({ resourceId }: EditorAssetThumbnailProps) => {
	const url = useEditorResourceUrl(resourceId);
	return (
		<span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-canvas/70">
			{url === undefined ? (
				<span className="text-sm font-semibold text-subtle">?</span>
			) : (
				<img
					src={url}
					alt=""
					className="size-full object-contain"
					draggable={false}
				/>
			)}
		</span>
	);
};
