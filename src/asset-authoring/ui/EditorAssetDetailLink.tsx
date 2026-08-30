import type { PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { ButtonLink } from "~/ui/button/Button";

/** Opens one asset while preserving an Assets-list search scoped to that resource. */
export const EditorAssetDetailLink = ({
	children,
	className,
	resourceId,
}: PropsWithChildren<{
	readonly className?: string;
	readonly resourceId: string;
}>) => {
	const project = useEditorProject();
	return (
		<ButtonLink
			to="/editor/$projectId/assets/$resourceId/detail/overview"
			params={{
				projectId: project.projectId,
				resourceId,
			}}
			search={{
				filter: "all",
				query: resourceId,
			}}
			className={twMerge(
				"min-h-0 border-0 bg-transparent p-0 text-left font-normal text-accent shadow-none hover:bg-transparent hover:text-accent-hover",
				className,
			)}
			title={`Open asset ${resourceId}`}
		>
			{children}
		</ButtonLink>
	);
};
