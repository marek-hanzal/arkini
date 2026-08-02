import { useEditorResourceUrl } from "~/ui/resource/editor/useEditorResourceUrl";

export interface EditorAssetThumbnailProps {
	readonly resourceId: string;
	readonly size?: "md" | "lg";
}

/** Renders one raw editor asset without applying item-composition semantics. */
export const EditorAssetThumbnail = ({ resourceId, size = "md" }: EditorAssetThumbnailProps) => {
	const url = useEditorResourceUrl(resourceId);
	return (
		<span
			className={`grid shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-canvas/70 ${size === "lg" ? "size-16" : "size-12"}`}
		>
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
