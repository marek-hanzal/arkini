import { createContext, useContext, type PropsWithChildren } from "react";

import type { useProjectFormController } from "~/project-authoring/ui/useProjectFormController";

const ProjectFormContext = createContext<useProjectFormController.Output | undefined>(undefined);

export const ProjectFormProvider = ({
	children,
	value,
}: PropsWithChildren<{
	readonly value: useProjectFormController.Output;
}>) => <ProjectFormContext value={value}>{children}</ProjectFormContext>;

/** Reads the one local Project draft shared by every routed Project section. */
export const useProjectFormSession = () => {
	const session = useContext(ProjectFormContext);
	if (session === undefined) throw new Error("Project routes require EditorProjectFormProvider.");
	return session;
};
