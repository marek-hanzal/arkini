import { createContext, useContext, type PropsWithChildren } from "react";

import type { EditorProjectFormController } from "~/project-authoring/ui/useEditorProjectFormController";

const EditorProjectFormContext = createContext<EditorProjectFormController | undefined>(undefined);

export const EditorProjectFormProvider = ({
	children,
	value,
}: PropsWithChildren<{
	readonly value: EditorProjectFormController;
}>) => <EditorProjectFormContext value={value}>{children}</EditorProjectFormContext>;

/** Reads the one local Project draft shared by every routed Project section. */
export const useEditorProjectFormSession = () => {
	const session = useContext(EditorProjectFormContext);
	if (session === undefined) throw new Error("Project routes require EditorProjectFormProvider.");
	return session;
};
