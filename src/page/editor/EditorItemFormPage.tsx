import type { PropsWithChildren } from "react";

import { EditorItemForm } from "~/ui/item/editor/EditorItemForm";

export const EditorItemFormPage = ({
	children,
	enableCapability,
	itemType,
	sectionId,
	uid,
}: PropsWithChildren<
	Pick<EditorItemForm.Props, "enableCapability" | "itemType" | "sectionId" | "uid">
>) => (
	<EditorItemForm
		enableCapability={enableCapability}
		itemType={itemType}
		sectionId={sectionId}
		uid={uid}
	>
		{children}
	</EditorItemForm>
);
