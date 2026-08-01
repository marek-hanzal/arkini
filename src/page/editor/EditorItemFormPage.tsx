import type { PropsWithChildren } from "react";

import { EditorItemForm } from "~/ui/item/editor/EditorItemForm";

export const EditorItemFormPage = ({
	children,
	itemType,
	uid,
}: PropsWithChildren<Pick<EditorItemForm.Props, "itemType" | "uid">>) => (
	<EditorItemForm
		itemType={itemType}
		uid={uid}
	>
		{children}
	</EditorItemForm>
);
