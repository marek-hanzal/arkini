import { useResourceUrl } from "~/authoring-session/ui/ResourceUrlSession";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { AudioLines, ImageOff } from "lucide-react";
import { useState } from "react";

const thumbnailSizeClassName = {
	input: "size-[var(--ak-control-min-height)]",
	lg: "size-24",
	md: "size-18",
	sm: "size-12",
	xl: "size-27",
} as const;

/** Audio references remain metadata-only until explicit preview; images request their own URL. */
export const EditorResourceThumbnail = ({
	resourceUid,
	size = "md",
}: {
	readonly resourceUid: string | undefined;
	readonly size?: keyof typeof thumbnailSizeClassName;
}) => {
	const project = useEditorProject();
	const resource = project.resources.find(({ uid }) => uid === resourceUid);
	const audio = resource?.type === "music" || resource?.type === "sfx";
	const url = useResourceUrl(audio ? undefined : resourceUid);
	const [failedUrl, setFailedUrlFn] = useState<string>();
	return (
		<span
			data-ui="EditorResourceThumbnail"
			className={`grid ${thumbnailSizeClassName[size]} shrink-0 place-items-center overflow-hidden rounded-lg bg-canvas/70`}
		>
			{audio ? (
				<AudioLines className="size-5 text-muted" />
			) : url === undefined || failedUrl === url ? (
				<ImageOff
					className={size === "input" ? "size-4 text-subtle" : "size-6 text-subtle"}
				/>
			) : (
				<img
					src={url}
					alt=""
					className="size-full object-contain"
					draggable={false}
					onError={() => setFailedUrlFn(url)}
				/>
			)}
		</span>
	);
};
