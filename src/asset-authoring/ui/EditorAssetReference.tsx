import type { ReactNode } from "react";

import { EditorAssetDetailLink } from "~/asset-authoring/ui/EditorAssetDetailLink";
import { EditorAssetThumbnail } from "~/authoring-form/ui/EditorAssetThumbnail";

/** Presents one embedded asset reference with its canonical preview and detail destination. */
export const EditorAssetReference = ({
	context,
	resourceId,
}: {
	readonly context?: ReactNode;
	readonly resourceId: string;
}) => (
	<div className="flex min-w-0 items-center gap-3">
		<EditorAssetThumbnail resourceId={resourceId} />
		<span className="flex min-w-0 items-center gap-2 text-sm">
			{context === undefined ? null : (
				<>
					<span className="shrink-0 font-mono font-semibold">{context}</span>
					<span className="text-muted">·</span>
				</>
			)}
			<EditorAssetDetailLink
				className="min-w-0 truncate font-mono"
				resourceId={resourceId}
			>
				{resourceId}
			</EditorAssetDetailLink>
		</span>
	</div>
);
