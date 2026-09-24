import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { LinkButtonLink } from "~/ui/ui/LinkButton";

/** Links an authored board-template reference when its target still exists. */
export const TemplateDetailReference = ({
	children,
	templateUid,
}: {
	readonly children: ReactNode;
	readonly templateUid: string;
}) => {
	const project = useEditorProject();
	const template = project.config.templates?.find((entry) => entry.uid === templateUid);
	if (template === undefined) return <span>{children}</span>;

	return (
		<LinkButtonLink
			to="/editor/$projectId/templates/$templateUid/detail/$sectionId"
			params={{
				projectId: project.projectId,
				templateUid,
				sectionId: "general",
			}}
			className="group inline-flex min-w-0 items-center gap-1 font-[inherit]"
			data-ui="TemplateDetailReference"
		>
			{children}
			<ArrowUpRight className="size-3.5 shrink-0 text-muted transition-colors group-hover:text-accent" />
		</LinkButtonLink>
	);
};
