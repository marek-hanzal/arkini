import type { PropsWithChildren } from "react";

import type { EditorItemSectionId } from "~/ui/item/editor/EditorItemSections";
import { EditorItemDetail } from "~/ui/item/editor/EditorItemDetail";

export const EditorItemDetailPage = ({
	children,
	sectionId,
	uid,
}: PropsWithChildren<{
	readonly sectionId: EditorItemSectionId;
	readonly uid: string;
}>) => (
	<EditorItemDetail
		sectionId={sectionId}
		uid={uid}
	>
		{children}
	</EditorItemDetail>
);
