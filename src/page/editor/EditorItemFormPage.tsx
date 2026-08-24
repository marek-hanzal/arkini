import type { PropsWithChildren } from "react";

import { EditorItemForm } from "~/ui/item/editor/EditorItemForm";

export const EditorItemFormPage = ({
	children,
	enableCapability,
	itemType,
	productionLineId,
	sectionId,
	uid,
}: PropsWithChildren<
	Pick<
		EditorItemForm.Props,
		"enableCapability" | "itemType" | "productionLineId" | "sectionId" | "uid"
	>
>) => (
	<EditorItemForm
		enableCapability={enableCapability}
		itemType={itemType}
		productionLineId={productionLineId}
		sectionId={sectionId}
		uid={uid}
	>
		{children}
	</EditorItemForm>
);
