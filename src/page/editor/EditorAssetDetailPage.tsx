import type { PropsWithChildren } from "react";

import { EditorAssetDetail } from "~/ui/resource/editor/EditorAssetDetail";

export const EditorAssetDetailPage = ({
	children,
	filter,
	query,
	resourceId,
}: PropsWithChildren<{
	readonly filter: "all" | "unused";
	readonly query: string;
	readonly resourceId: string;
}>) => (
	<EditorAssetDetail
		filter={filter}
		query={query}
		resourceId={resourceId}
	>
		{children}
	</EditorAssetDetail>
);
