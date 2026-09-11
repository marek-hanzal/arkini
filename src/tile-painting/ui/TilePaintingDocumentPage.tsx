import { LoaderCircle } from "lucide-react";
import { LinkButtonLink } from "~/ui/ui/LinkButton";
import { useEffect, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { Effect } from "effect";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { TilePaintingSessionProvider } from "~/tile-painting/ui/useTilePaintingSession";
import { TilePaintingWorkspace } from "~/tile-painting/ui/TilePaintingWorkspace";
import type { TilePaintingSchema } from "~/tile-painting/schema/TilePaintingSchema";

/** Reacquires the recipe when project replacement remounts the workspace, not from stale route loader data. */
export const TilePaintingDocumentPage = ({ paintingId }: { readonly paintingId: string }) => {
	const project = useEditorProject();
	const [loaded, setLoadedFn] = useState<TilePaintingSchema.Type | null>();
	const [error, setErrorFn] = useState<string | null>(null);
	useEffect(() => {
		const abort = new AbortController();
		setLoadedFn(undefined);
		setErrorFn(null);
		void RendererRuntime.runPromise(
			Effect.flatMap(ProjectRepository, (repository) =>
				repository.readTilePaintingFx({
					projectId: project.projectId,
					paintingId,
				}),
			),
			{
				signal: abort.signal,
			},
		)
			.then((painting) => {
				if (!abort.signal.aborted) setLoadedFn(painting);
			})
			.catch((cause) => {
				if (!abort.signal.aborted)
					setErrorFn(cause instanceof Error ? cause.message : String(cause));
			});
		return () => abort.abort();
	}, [
		project.projectId,
		paintingId,
	]);
	if (error !== null || loaded === null)
		return (
			<div className="grid gap-4 p-5">
				<h1 className="font-semibold">{error ?? "Painting not found"}</h1>
				<LinkButtonLink
					to="/editor/$projectId/painter"
					params={{
						projectId: project.projectId,
					}}
				>
					All paintings
				</LinkButtonLink>
			</div>
		);
	if (loaded === undefined)
		return (
			<div className="p-5 text-muted">
				<LoaderCircle className="size-5 animate-spin" />
			</div>
		);
	return (
		<TilePaintingSessionProvider
			key={`${loaded.projectId}:${loaded.paintingId}`}
			loaded={loaded}
		>
			<TilePaintingWorkspace>
				<Outlet />
			</TilePaintingWorkspace>
		</TilePaintingSessionProvider>
	);
};
