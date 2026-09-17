import { useResourceUrl } from "~/authoring-session/ui/ResourceUrlSession";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { AudioLines } from "lucide-react";

const thumbnailSizeClassName = {
	input: "size-[var(--ak-control-min-height)]",
	lg: "size-24",
	md: "size-18",
	sm: "size-12",
	xl: "size-27",
} as const;

/** Audio references remain metadata-only until explicit preview; images request their own URL. */
export const EditorResourceThumbnail = ({
	resourceId,
	size = "md",
}: {
	readonly resourceId: string | undefined;
	readonly size?: keyof typeof thumbnailSizeClassName;
}) => {
	const project = useEditorProject();
	const resource = project.resources.find(({ id }) => id === resourceId);
	const audio = resource?.type === "music" || resource?.type === "sfx";
	const url = useResourceUrl(audio ? undefined : resourceId);
	return (
		<span
			data-ui="EditorResourceThumbnail"
			className={`grid ${thumbnailSizeClassName[size]} shrink-0 place-items-center overflow-hidden rounded-lg border border-control-border bg-canvas/70`}
		>
			{audio ? (
				<AudioLines className="size-5 text-muted" />
			) : url === undefined ? (
				resourceId ? (
					<span className="text-sm font-semibold text-subtle">?</span>
				) : null
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
