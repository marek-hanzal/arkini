import {
	ArrowRight,
	Boxes,
	GitBranch,
	Images,
	LoaderCircle,
	PackageCheck,
	TriangleAlert,
	type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { useItemEstimateIndex } from "~/estimate/ui/useItemEstimateIndex";
import type { Project } from "~/project-authoring/type/Project";
import { useProjectVersionStatus } from "~/project-version/ui/useProjectVersionStatus";
import { LinkButton, LinkButtonLink } from "~/ui/ui/LinkButton";

const ProjectOverviewCard = ({
	action,
	children,
	header,
}: {
	readonly action: ReactNode;
	readonly children: ReactNode;
	readonly header: ReactNode;
}) => (
	<EditorRootCard className="gap-4">
		{header}
		<div className="text-lg text-foreground">{children}</div>
		<div className="flex justify-end">{action}</div>
	</EditorRootCard>
);

const ProjectOverviewHeading = ({
	children,
	icon: Icon,
}: {
	readonly children: ReactNode;
	readonly icon: LucideIcon;
}) => (
	<span className="flex items-center gap-2">
		<Icon className="size-4" />
		<span className="font-semibold">{children}</span>
	</span>
);

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
	const workingCopySummary =
		versionStatus === undefined
			? versionState.status === "loading"
				? "Loading…"
				: "Unavailable"
			: versionStatus.currentBaseVersionId === undefined
				? "Unversioned"
				: versionStatus.dirty
					? "Dirty"
					: "Clean";
	const unreachableCount = estimateState.rows.filter(
		({ estimate }) => estimate.status === "unreachable",
	).length;
	const itemCount = Object.keys(project.config.items).length;

	return (
		<section
			className="flex flex-col gap-[var(--ak-viewport-gap)]"
			data-ui="EditorProjectOverview"
		>
			<ProjectOverviewCard
				action={
					<div className="flex w-full items-end justify-between gap-4">
						<div className="flex items-center gap-3">
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
					</div>
				}
				header={<ProjectOverviewHeading icon={GitBranch}>Versions</ProjectOverviewHeading>}
			>
				{versionCountSummary}
			</ProjectOverviewCard>
			<ProjectOverviewCard
				action={
					<LinkButtonLink
						className="inline-flex items-center gap-1.5"
						data-overview-id="arkpack-version"
						data-ui="EditorProjectOverviewLink"
						params={{
							projectId: project.projectId,
						}}
						to="/editor/$projectId/build"
					>
						Build
						<ArrowRight className="size-4" />
					</LinkButtonLink>
				}
				header={
					<ProjectOverviewHeading icon={PackageCheck}>
						Arkpack version
					</ProjectOverviewHeading>
				}
			>
				v{project.version}
			</ProjectOverviewCard>
			<ProjectOverviewCard
				action={
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
				header={<ProjectOverviewHeading icon={Boxes}>Items</ProjectOverviewHeading>}
			>
				{itemCount} {itemCount === 1 ? "item" : "items"}
			</ProjectOverviewCard>
			<ProjectOverviewCard
				action={
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
						Estimate
						<ArrowRight className="size-4" />
					</LinkButtonLink>
				}
				header={
					<ProjectOverviewHeading icon={TriangleAlert}>
						Unreachable items
					</ProjectOverviewHeading>
				}
			>
				{estimateState.status === "loading" ? (
					<span className="inline-flex items-center gap-2">
						<LoaderCircle className="size-4 animate-spin text-subtle" />
						Calculating…
					</span>
				) : estimateState.status === "error" ? (
					"Unavailable"
				) : (
					`${unreachableCount} unreachable ${unreachableCount === 1 ? "item" : "items"}`
				)}
			</ProjectOverviewCard>
			<ProjectOverviewCard
				action={
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
				header={<ProjectOverviewHeading icon={Images}>Assets</ProjectOverviewHeading>}
			>
				{project.resources.length} {project.resources.length === 1 ? "asset" : "assets"}
			</ProjectOverviewCard>
		</section>
	);
};
