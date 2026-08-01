import { createContext, useContext, type PropsWithChildren } from "react";

import type { EditorItemType } from "~/bridge/item/editor/EditorItemModel";
import type { EditorItemFormController } from "~/ui/item/editor/useEditorItemFormController";

export type EditorItemFormRoute =
	| {
			readonly kind: "create";
			readonly itemType: EditorItemType;
	  }
	| {
			readonly kind: "edit";
	  };

export type EditorItemFormSession = EditorItemFormController & {
	readonly route: EditorItemFormRoute;
};

const EditorItemFormContext = createContext<EditorItemFormSession | undefined>(undefined);

export const EditorItemFormProvider = ({
	children,
	value,
}: PropsWithChildren<{
	readonly value: EditorItemFormSession;
}>) => <EditorItemFormContext value={value}>{children}</EditorItemFormContext>;

/** Reads the exact local item form session owned by the create/edit parent route. */
export const useEditorItemFormSession = () => {
	const session = useContext(EditorItemFormContext);
	if (session === undefined) {
		throw new Error("Item section routes require EditorItemFormProvider.");
	}
	return session;
};
