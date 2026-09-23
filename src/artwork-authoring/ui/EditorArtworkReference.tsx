import { useEditorArtworkByUid } from "~/artwork-authoring/ui/useEditorArtworkByUid";
import type { ReactNode } from "react";

import { EditorArtworkDetailLink } from "~/artwork-authoring/ui/EditorArtworkDetailLink";
import { EditorResourceThumbnail } from "~/authoring-form/ui/EditorResourceThumbnail";

/** Presents one embedded artwork reference with its canonical preview and detail destination. */
export const EditorArtworkReference = ({
	context,
	resourceUid,
}: {
	readonly context?: ReactNode;
	readonly resourceUid: string;
}) => {
	const resource = useEditorArtworkByUid(resourceUid);
	return (
		<div className="flex min-w-0 items-center gap-3">
			<EditorResourceThumbnail resourceUid={resourceUid} />
			<span className="flex min-w-0 items-center gap-2 text-sm">
				{context === undefined ? null : (
					<>
						<span className="shrink-0 font-mono font-semibold">{context}</span>
						<span className="text-muted">·</span>
					</>
				)}
				<EditorArtworkDetailLink
					className="min-w-0 truncate font-mono"
					resourceUid={resource?.title ?? resourceUid}
				>
					{resource?.title ?? resourceUid}
				</EditorArtworkDetailLink>
			</span>
		</div>
	);
};
