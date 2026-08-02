import type { PropsWithChildren } from "react";

import { EditorItemForm } from "~/ui/item/editor/EditorItemForm";

export const EditorItemFormPage = ({
	children,
	itemType,
	sectionId,
	uid,
}: PropsWithChildren<Pick<EditorItemForm.Props, "itemType" | "sectionId" | "uid">>) => (
	<EditorItemForm
		itemType={itemType}
		sectionId={sectionId}
		uid={uid}
	>
		{children}
	</EditorItemForm>
);
