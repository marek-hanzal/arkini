import { useMatchRoute } from "@tanstack/react-router";
import {
	FolderKanban,
	FolderOpen,
	FolderX,
	LoaderCircle,
	PackageOpen,
	Play,
	Sparkles,
	Trash2,
} from "lucide-react";

import { formatVersionFn } from "~/game-version/fn/formatVersionFn";
import type { ProjectCandidate } from "~/project-authoring/schema/ProjectCandidateSchema";
import type { SerapackCatalog } from "~/serapack-catalog/service/SerapackCatalog";
import { createYourGamesRowsFn } from "~/serapack-selector/fn/createYourGamesRowsFn";
import { useTranslator } from "~/translation/ui/useTranslator";
import { PrimaryButton, PrimaryButtonLink } from "~/ui/ui/Button";
import { LinkButton, LinkButtonLink } from "~/ui/ui/LinkButton";

import "./YourGamesList.css";

const formatter = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
});

interface YourGamesListProps {
	readonly blocked: boolean;
	readonly pendingProjectId?: string;
	readonly projects: ReadonlyArray<ProjectCandidate>;
	readonly state: SerapackCatalog.State;
	readonly onDeleteProjectFn: (
		candidate: Extract<
			ProjectCandidate,
			{
				type: "valid";
			}
		>,
	) => void;
	readonly onDismissInvalidProjectFn: (root: string) => void;
	readonly onOpenEditorSerapackFn: (packageId: string) => void;
	readonly onOpenProjectFolderFn: (root: string) => void;
	readonly onPlayProjectFn: (projectId: string) => void;
	readonly onRemoveSerapackFn: (packageId: string) => void;
}

/** Renders one row per game identity, preferring Editor metadata when both forms exist. */
export const YourGamesList = ({
	blocked,
	pendingProjectId,
	projects,
	state,
	onDeleteProjectFn,
	onDismissInvalidProjectFn,
	onOpenEditorSerapackFn,
	onOpenProjectFolderFn,
	onPlayProjectFn,
	onRemoveSerapackFn,
}: YourGamesListProps) => {
	const translator = useTranslator();
	const matchRouteFn = useMatchRoute();
	const openingProject = matchRouteFn({
		to: "/editor/$projectId",
		pending: true,
		fuzzy: true,
		includeSearch: false,
	});
	if (state.type === "loading")
		return <p className="text-sm text-muted">Reading local packages…</p>;
	const serapacks = state.type === "ready" ? state.serapacks : [];
	return (
		<div
			className="ak-list grid gap-2"
			data-ui="YourGamesList"
		>
			{state.type === "failed" ? (
				<p className="text-sm text-danger">Package catalog failed: {String(state.error)}</p>
			) : null}
			{createYourGamesRowsFn(projects, serapacks).map((row) => {
				if (row.type === "invalid-project")
					return (
						<div
							key={`invalid:${row.candidate.root}`}
							className="ak-list-row flex min-w-0 items-center gap-3 px-4 py-3"
							data-ui="YourGamesInvalidProjectRow"
						>
							<FolderX className="size-5 shrink-0 text-danger" />
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm font-semibold">
									{row.candidate.title}
								</span>
								<span className="mt-1 block break-all text-xs text-subtle">
									{row.candidate.root}
								</span>
								<span className="mt-1 block text-xs text-danger">
									{row.candidate.validationError}
								</span>
							</span>
							<LinkButton
								disabled={blocked}
								className="inline-flex shrink-0 items-center gap-1.5"
								onClick={() => onOpenProjectFolderFn(row.candidate.root)}
							>
								<FolderOpen className="size-4" />
								{translator.textFn("Open folder")}
							</LinkButton>
							<LinkButton
								disabled={blocked}
								className="shrink-0"
								title={translator.textFn("Remove from Recent")}
								onClick={() => onDismissInvalidProjectFn(row.candidate.root)}
							>
								<Trash2 className="size-4" />
							</LinkButton>
						</div>
					);

				const project = row.type === "project" ? row.candidate.project : undefined;
				const serapack = row.serapack;
				const gameId =
					row.type === "project"
						? row.candidate.project.projectId
						: row.serapack.packageId;
				return (
					<article
						key={gameId}
						className="ak-list-row flex min-w-0 items-center gap-3 px-4 py-3"
						data-row-kind={project === undefined ? "serapack" : "project"}
						data-ui="YourGamesRow"
					>
						{project === undefined ? (
							<PackageOpen className="size-5 shrink-0 text-accent" />
						) : openingProject && openingProject.projectId === project.projectId ? (
							<LoaderCircle className="size-5 shrink-0 animate-spin text-accent" />
						) : (
							<FolderKanban className="size-5 shrink-0 text-accent" />
						)}
						<div className="min-w-0 flex-1">
							<div className="flex min-w-0 items-center gap-2">
								<h2 className="truncate text-sm font-semibold">
									{row.type === "project"
										? row.candidate.project.title
										: row.serapack.title}
								</h2>
								{row.type === "project" ? (
									<span className="shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
										{row.candidate.ownership === "managed"
											? translator.textFn("Managed")
											: translator.textFn("Custom")}
									</span>
								) : (
									<span className="shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
										{row.serapack.provenance.type === "official"
											? "Official"
											: "Community"}
									</span>
								)}
								{serapack?.overridesBundled ? (
									<span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-accent">
										User override
									</span>
								) : null}
							</div>
							<p className="mt-1 truncate text-xs text-subtle">
								{row.type === "serapack" ? (
									(row.serapack.filename ??
									`${row.serapack.packageId} · ${row.serapack.serakki}`)
								) : (
									<>
										{row.candidate.project.projectId} · v
										{formatVersionFn(row.candidate.project.version)} ·{" "}
										<time
											dateTime={new Date(
												row.candidate.project.updatedAtMs,
											).toISOString()}
										>
											{formatter.format(row.candidate.project.updatedAtMs)}
										</time>
									</>
								)}
							</p>
						</div>
						<div className="flex shrink-0 items-center gap-4">
							{serapack?.source === "user" ? (
								<LinkButton
									className="inline-flex items-center gap-1.5 text-xs"
									disabled={blocked}
									onClick={() => onRemoveSerapackFn(serapack.packageId)}
								>
									<Trash2 className="size-4" />
									Remove
								</LinkButton>
							) : null}
							{row.type === "project" ? (
								<>
									<button
										type="button"
										disabled={blocked}
										className="grid size-8 shrink-0 cursor-pointer place-items-center border-0 bg-transparent p-0 text-subtle transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-subtle"
										data-ui="YourGamesProjectDelete"
										title={translator.textFn("Remove project")}
										onClick={() => onDeleteProjectFn(row.candidate)}
									>
										<Trash2 className="size-4" />
									</button>
									<LinkButtonLink
										to="/editor/$projectId/editor/items/list"
										params={{
											projectId: row.candidate.project.projectId,
										}}
										disabled={blocked}
										className="inline-flex items-center gap-1.5 text-xs"
									>
										<Sparkles className="size-4" />
										Editor
									</LinkButtonLink>
								</>
							) : (
								<LinkButton
									className="inline-flex items-center gap-1.5 text-xs"
									disabled={blocked}
									onClick={() => onOpenEditorSerapackFn(row.serapack.packageId)}
								>
									<Sparkles className="size-4" />
									Editor
								</LinkButton>
							)}
							{row.type === "serapack" ? (
								<PrimaryButtonLink
									to="/action/load-game/$packageId"
									preload={false}
									params={{
										packageId: row.serapack.packageId,
									}}
									disabled={blocked}
									className="min-h-0 gap-1.5 px-3 py-2 text-xs shadow-none"
								>
									<Play className="size-4" />
									Play
								</PrimaryButtonLink>
							) : (
								<PrimaryButton
									disabled={blocked}
									cursorIntent={
										pendingProjectId === row.candidate.project.projectId
											? "progress"
											: undefined
									}
									className="min-h-0 gap-1.5 px-3 py-2 text-xs shadow-none"
									onClick={() => onPlayProjectFn(row.candidate.project.projectId)}
								>
									{pendingProjectId === row.candidate.project.projectId ? (
										<LoaderCircle className="size-4 animate-spin" />
									) : (
										<Play className="size-4" />
									)}
									{pendingProjectId === row.candidate.project.projectId
										? "Preparing…"
										: "Play"}
								</PrimaryButton>
							)}
						</div>
					</article>
				);
			})}
		</div>
	);
};
