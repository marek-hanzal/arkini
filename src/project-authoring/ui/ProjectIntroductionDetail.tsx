import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import type { Project } from "~/project-authoring/type/Project";
import { Markdown } from "~/ui/ui/Markdown";
import { Tx } from "~/translation/ui/Tx";

export const ProjectIntroductionDetail = ({ project }: { readonly project: Project }) => (
	<EditorRootCard dataUi="ProjectIntroductionDetail">
		{project.config.meta.introduction?.trim() ? (
			<Markdown>{project.config.meta.introduction}</Markdown>
		) : (
			<p className="text-muted">
				<Tx label="No introduction. New games start immediately." />
			</p>
		)}
	</EditorRootCard>
);
