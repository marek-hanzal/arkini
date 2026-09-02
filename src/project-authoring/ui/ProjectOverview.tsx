import { ArrowRight, Boxes, GitBranch, Images, LoaderCircle, TriangleAlert } from "lucide-react";
import { Fragment } from "react";

import { EditorOverviewCard } from "~/authoring-shell/ui/EditorOverviewCard";
import { useItemEstimateIndex } from "~/estimate/ui/useItemEstimateIndex";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { Project } from "~/project-authoring/type/Project";
import { useProjectVersionStatus } from "~/project-version/ui/useProjectVersionStatus";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { LinkButton, LinkButtonLink } from "~/ui/ui/LinkButton";

/** Presents project-wide repository, content, Estimate, and asset summaries. */
export const ProjectOverview = ({ project }: { readonly project: Project }) => {
	const versionState = useProjectVersionStatus(project.projectId);
	const estimateState = useItemEstimateIndex(project, {
		query: "",
		view: "incomplete",
	});
	const versionStatus = versionState.status === "ready" ? versionState.versionStatus : undefined;
	const versionCountSummary =
		versionStatus === undefined
			? versionState.status === "loading"
				? "Loading…"
				: "Unavailable"
			: `${versionStatus.versionCount} saved ${versionStatus.versionCount === 1 ? "version" : "versions"}`;
	const workingCopyStatus =
		versionStatus === undefined
			? versionState.status === "loading"
				? "loading"
				: "unavailable"
			: versionStatus.currentBaseVersionId === undefined
				? "unversioned"
				: versionStatus.dirty
					? "dirty"
					: "clean";
	const workingCopySummary = {
		clean: "Clean",
		dirty: "Dirty",
		loading: "Loading…",
		unavailable: "Unavailable",
		unversioned: "Unversioned",
	}[workingCopyStatus];
	const unreachableCount = estimateState.rows.filter(
		({ estimate }) => estimate.status === "unreachable",
	).length;
	const items = Object.values(project.config.items);
	const itemCount = items.length;
	const itemTypeCounts = TypeSchema.options.flatMap((type) => {
		const count = items.filter((item) => item.type === type).length;
		return count === 0
			? []
			: [
					{
						count,
						type,
					},
				];
	});
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
			<EditorOverviewCard
				body={
					<div className="flex flex-wrap items-center gap-3">
						<span>{versionCountSummary}</span>
						<span className="h-5 w-px bg-line" />
						<span>v{project.version}</span>
						<span className="text-subtle">·</span>
						<LinkButtonLink
							data-overview-id="arkpack-version"
							data-ui="EditorProjectOverviewLink"
							params={{
								projectId: project.projectId,
							}}
							to="/editor/$projectId/build"
						>
							Build
						</LinkButtonLink>
					</div>
				}
				footerLeft={
					<div
						className="group flex items-center gap-3"
						{...readDataUiFn({
							dataUi: "EditorProjectOverviewVersionStatus",
							state: {
								status: workingCopyStatus,
							},
						})}
					>
						<span className="size-2 shrink-0 rounded-full bg-muted group-data-[ui-status=clean]:bg-success group-data-[ui-status=dirty]:bg-warning" />
						<span>{workingCopySummary}</span>
						<span className="text-subtle">·</span>
						{versionStatus?.canCommit === true ? (
							<LinkButtonLink
								data-overview-id="versions-commit"
								data-ui="EditorProjectOverviewLink"
								params={{
									projectId: project.projectId,
								}}
								to="/editor/$projectId/versions/commit"
							>
								Commit
							</LinkButtonLink>
						) : (
							<LinkButton
								data-ui="EditorProjectOverviewCommitUnavailable"
								disabled
							>
								Commit
							</LinkButton>
						)}
						<span className="h-5 w-px bg-line" />
						<LinkButtonLink
							data-overview-id="versions-history"
							data-ui="EditorProjectOverviewLink"
							params={{
								projectId: project.projectId,
							}}
							to="/editor/$projectId/versions/history"
						>
							History
						</LinkButtonLink>
					</div>
				}
				footerRight={
					<LinkButtonLink
						className="inline-flex items-center gap-1.5"
						data-overview-id="versions"
						data-ui="EditorProjectOverviewLink"
						params={{
							projectId: project.projectId,
						}}
						to="/editor/$projectId/versions/commit"
					>
						Versions
						<ArrowRight className="size-4" />
					</LinkButtonLink>
				}
				icon={GitBranch}
				title="Versions"
			/>
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
				footerLeft={
					itemTypeCounts.length === 0 ? undefined : (
						<div className="flex flex-wrap items-center gap-2">
							{itemTypeCounts.map(({ count, type }, index) => (
								<Fragment key={type}>
									{index === 0 ? null : <span className="text-subtle">·</span>}
									<LinkButtonLink
										className="capitalize"
										data-overview-id={`items-type-${type}`}
										data-ui="EditorProjectOverviewLink"
										params={{
											projectId: project.projectId,
										}}
										search={{
											itemType: type,
										}}
										to="/editor/$projectId/editor/items/list"
									>
										{type} ({count})
									</LinkButtonLink>
								</Fragment>
							))}
						</div>
					)
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
