import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { createContext, useContext, type PropsWithChildren } from "react";
import type { useEditorItemFormController } from "~/item-authoring/ui/useEditorItemFormController";

type EditorItemFormSession = ReturnType<typeof useEditorItemFormController> & {
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
