import type { TypeSchema } from "~/engine/item/schema/TypeSchema";
import { createContext, useContext, type PropsWithChildren } from "react";
import type { EditorItemFormController } from "~/ui/item/editor/useEditorItemFormController";

export type EditorItemFormSession = EditorItemFormController & {
	readonly isNew: boolean;
	readonly itemType?: TypeSchema.Type;
	readonly productionLineId?: string;
};

const EditorItemFormContext = createContext<EditorItemFormSession | undefined>(undefined);

export const EditorItemFormProvider = ({
	children,
	value,
}: PropsWithChildren<{
	readonly value: EditorItemFormSession;
}>) => <EditorItemFormContext value={value}>{children}</EditorItemFormContext>;

/** Reads the exact local item form session owned by the item form parent route. */
export const useEditorItemFormSession = () => {
	const session = useContext(EditorItemFormContext);
	if (session === undefined) {
		throw new Error("Item section routes require EditorItemFormProvider.");
	}
	return session;
};
