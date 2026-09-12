import { ArrowRight, Boxes, Images, LoaderCircle, TriangleAlert } from "lucide-react";

import { EditorOverviewCard } from "~/authoring-shell/ui/EditorOverviewCard";
import { useItemEstimateIndex } from "~/estimate/ui/useItemEstimateIndex";
import type { Project } from "~/project-authoring/type/Project";
import { ProjectNotesOverview } from "~/project-note/ui/ProjectNotesOverview";
import { LinkButtonLink } from "~/ui/ui/LinkButton";

/** Presents project-wide repository, content, Estimate, and asset summaries. */
export const ProjectOverview = ({ project }: { readonly project: Project }) => {
	const estimateState = useItemEstimateIndex(project, {
		query: "",
		view: "incomplete",
	});
	const unreachableCount = estimateState.rows.filter(
		({ estimate }) => estimate.status === "unreachable",
	).length;
	const items = Object.values(project.config.items);
	const itemCount = items.length;
	const unreachableSummary =
		estimateState.status === "loading" ? (
			<span
				className="inline-flex items-center gap-1.5 text-muted"
				data-ui="EditorProjectOverviewUnreachableLoading"
			>
				<LoaderCircle className="size-4 animate-spin" />
				Calculating…
			</span>
		) : estimateState.status === "ready" && unreachableCount > 0 ? (
			<LinkButtonLink
				className="inline-flex items-center gap-1.5"
				data-overview-id="unreachable-items"
				data-ui="EditorProjectOverviewLink"
				params={{
					projectId: project.projectId,
				}}
				search={{
					view: "incomplete",
				}}
				to="/editor/$projectId/estimate"
			>
				<TriangleAlert className="size-4" />
				{unreachableCount} unreachable {unreachableCount === 1 ? "item" : "items"}
			</LinkButtonLink>
		) : null;

	return (
		<section
			className="flex flex-col gap-[var(--ak-viewport-gap)]"
			data-ui="EditorProjectOverview"
		>
			<ProjectNotesOverview projectId={project.projectId} />
			<EditorOverviewCard
				body={
					<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
						<span>
							{itemCount} {itemCount === 1 ? "item" : "items"}
						</span>
						{unreachableSummary === null ? null : <span className="h-5 w-px bg-line" />}
						{unreachableSummary}
					</div>
				}
				footerRight={
					<LinkButtonLink
						className="inline-flex items-center gap-1.5"
						data-overview-id="items"
						data-ui="EditorProjectOverviewLink"
						params={{
							projectId: project.projectId,
						}}
						to="/editor/$projectId/editor/items/list"
					>
						Items
						<ArrowRight className="size-4" />
					</LinkButtonLink>
				}
				icon={Boxes}
				title="Items"
			/>
			<EditorOverviewCard
				body={`${project.resources.length} ${project.resources.length === 1 ? "asset" : "assets"}`}
				footerRight={
					<LinkButtonLink
						className="inline-flex items-center gap-1.5"
						data-overview-id="assets"
						data-ui="EditorProjectOverviewLink"
						params={{
							projectId: project.projectId,
						}}
						to="/editor/$projectId/assets"
					>
						Assets
						<ArrowRight className="size-4" />
					</LinkButtonLink>
				}
				icon={Images}
				title="Assets"
			/>
		</section>
	);
};
