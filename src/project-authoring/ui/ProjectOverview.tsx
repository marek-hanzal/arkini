import { ArrowRight } from "lucide-react";

import { EditorOverviewCard } from "~/authoring-shell/ui/EditorOverviewCard";
import type { Project } from "~/project-authoring/type/Project";
import { ProjectNotesOverview } from "~/project-note/ui/ProjectNotesOverview";
import { useTranslator } from "~/translation/ui/useTranslator";
import { LinkButtonLink } from "~/ui/ui/LinkButton";

/** Presents project-wide content and artwork summaries. */
export const ProjectOverview = ({ project }: { readonly project: Project }) => {
	const translator = useTranslator();
	const items = Object.values(project.config.items);
	const itemCount = items.length;
	const artworkCount = project.resources.filter(({ type }) => type === "artwork").length;

	return (
		<section
			className="grid gap-[var(--ak-viewport-gap)] min-[64rem]:grid-cols-2"
			data-ui="EditorProjectOverview"
		>
			<ProjectNotesOverview projectId={project.projectId} />
			<EditorOverviewCard
				body={translator
					.textFn(itemCount === 1 ? "Project item count" : "Project items count")
					.replace("{count}", String(itemCount))}
				action={
					<LinkButtonLink
						className="inline-flex items-center gap-1.5 opacity-75 hover:opacity-100"
						data-overview-id="items"
						data-ui="EditorProjectOverviewLink"
						params={{
							projectId: project.projectId,
						}}
						to="/editor/$projectId/editor/items/list"
					>
						{translator.textFn("Open")}
						<ArrowRight className="size-4" />
					</LinkButtonLink>
				}
				title={translator.textFn("Items")}
			/>
			<EditorOverviewCard
				body={translator
					.textFn("Project artwork count")
					.replace("{count}", String(artworkCount))}
				action={
					<LinkButtonLink
						className="inline-flex items-center gap-1.5 opacity-75 hover:opacity-100"
						data-overview-id="artwork"
						data-ui="EditorProjectOverviewLink"
						params={{
							projectId: project.projectId,
						}}
						to="/editor/$projectId/artwork"
					>
						{translator.textFn("Open")}
						<ArrowRight className="size-4" />
					</LinkButtonLink>
				}
				title={translator.textFn("Artwork")}
			/>
		</section>
	);
};
