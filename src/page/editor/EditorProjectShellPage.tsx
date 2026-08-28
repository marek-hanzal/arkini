import type { ComponentProps, PropsWithChildren } from "react";

import { EditorProjectWorkspace } from "~/ui/editor/EditorProjectWorkspace";

/** Composes the project workspace at the page boundary. */
export const EditorProjectShellPage = ({
	children,
	project,
}: PropsWithChildren<Pick<ComponentProps<typeof EditorProjectWorkspace>, "project">>) => (
	<EditorProjectWorkspace project={project}>{children}</EditorProjectWorkspace>
);
