import { Tooltip } from "~/ui/ui/Tooltip";
import { LinkButton, LinkButtonLink } from "~/ui/ui/LinkButton";
import { PrimaryButton } from "~/ui/ui/Button";
import { TilePaintingCanvasSize } from "~/tile-painting/constant/TilePaintingCanvasSize";
import { createId } from "@paralleldrive/cuid2";
import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Effect } from "effect";
import { Paintbrush, Plus, Trash2, RefreshCw, ChevronRight, Check } from "lucide-react";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { TilePaintingBakeAtom } from "~/tile-painting/atom/TilePaintingBakeAtom";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { Status } from "~/ui/ui/Status";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { EditorTextControl } from "~/editor-control/ui/EditorValueControls";
import { TilePaintingDialog } from "~/tile-painting/ui/TilePaintingDialog";
import type { TilePaintingSchema } from "~/tile-painting/schema/TilePaintingSchema";
import { EditorAssetThumbnail } from "~/authoring-form/ui/EditorAssetThumbnail";

/** Lists portable painting recipes; creating a recipe does not create a gameplay asset. */
export const TilePaintingLibrary = () => {
	const project = useEditorProject();
	const navigateFn = useNavigate();
	const [paintings, setPaintingsFn] = useState<ReadonlyArray<TilePaintingSchema.Type>>([]);
	const [loading, setLoadingFn] = useState(true);
	const [localBusy, setBusyFn] = useState(false);
	const bakeAtom = TilePaintingBakeAtom(project.projectId);
	const bakeState = useAtomValue(bakeAtom);
	const bakeCommandFn = useAtomSet(bakeAtom);
	const bakePending = bakeState.kind === "baking";
	const busy = localBusy || bakePending;
	const bakePercent =
		bakeState.kind === "baking" && bakeState.progress.total > 0
			? Math.min(
					100,
					Math.floor((100 * bakeState.progress.completed) / bakeState.progress.total),
				)
			: 0;
	const bakeTitle =
		bakeState.kind === "success"
			? `Baked ${bakeState.result.bakedCount} assets. ${bakeState.result.skippedCount} paintings have no output asset yet.`
			: "Rebuild all output assets from their current source images";
	const bakeError =
		bakeState.kind === "failure"
			? bakeState.error instanceof Error
				? bakeState.error.message
				: String(bakeState.error)
			: null;
	const [error, setErrorFn] = useState<string | null>(null);
	const [createOpen, setCreateOpenFn] = useState(false);
	const [deleteCandidate, setDeleteCandidateFn] = useState<TilePaintingSchema.Type | null>(null);
	const [name, setNameFn] = useState("Untitled tile");
	useEffect(() => {
		let active = true;
		setLoadingFn(true);
		void RendererRuntime.runPromise(
			Effect.flatMap(ProjectRepository, (repository) =>
				repository.listTilePaintingsFx(project.projectId),
			),
		)
			.then((result) => {
				if (active) setPaintingsFn(result);
			})
			.catch((cause) => {
				if (active) setErrorFn(cause instanceof Error ? cause.message : String(cause));
			})
			.finally(() => {
				if (active) setLoadingFn(false);
			});
		return () => {
			active = false;
		};
	}, [
		project.projectId,
		project.revision,
	]);
	const createFn = async () => {
		if (busy) return;
		setBusyFn(true);
		setErrorFn(null);
		try {
			const paintingId = createId();
			await RendererRuntime.runPromise(
				Effect.flatMap(ProjectRepository, (repository) =>
					repository.saveTilePaintingFx({
						projectId: project.projectId,
						paintingId,
						expectedRevision: project.revision,
						expectedUpdatedAtMs: null,
						document: {
							name: name.trim(),
							images: [],
							layers: [],
							catalog: [],
							scatter: [],
							preview: {
								columns: 3,
								rows: 3,
								cells: Array.from(
									{
										length: 9,
									},
									() => ({
										kind: "painting" as const,
									}),
								),
							},
							reference: null,
						},
					}),
				),
			);
			await navigateFn({
				to: "/editor/$projectId/painter/$paintingId/layers",
				params: {
					projectId: project.projectId,
					paintingId,
				},
			});
		} catch (cause) {
			setErrorFn(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setBusyFn(false);
		}
	};
	const deleteFn = async () => {
		if (busy || deleteCandidate === null) return;
		setBusyFn(true);
		setErrorFn(null);
		try {
			await RendererRuntime.runPromise(
				Effect.flatMap(ProjectRepository, (repository) =>
					repository.deleteTilePaintingFx({
						projectId: project.projectId,
						paintingId: deleteCandidate.paintingId,
						expectedRevision: project.revision,
						expectedUpdatedAtMs: deleteCandidate.updatedAtMs,
					}),
				),
			);
			setPaintingsFn((current) =>
				current.filter((painting) => painting.paintingId !== deleteCandidate.paintingId),
			);
			setDeleteCandidateFn(null);
		} catch (cause) {
			setErrorFn(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setBusyFn(false);
		}
	};
	const bakeAllFn = () => {
		if (busy) return;
		setErrorFn(null);
		bakeCommandFn({
			kind: "bake",
			total: paintings.filter((painting) => painting.outputResourceId !== null).length,
		});
	};
	return (
		<EditorSectionPage
			header={
				<EditorSectionNavigation
					title={
						<h1 className="flex items-center gap-3 text-xl font-semibold">
							<Paintbrush className="size-5" />
							Tile painter
						</h1>
					}
					action={
						<div className="relative flex items-center gap-1">
							{bakePending ? (
								<span className="pointer-events-none absolute right-full mr-2 whitespace-nowrap text-xs tabular-nums text-muted">
									{bakePercent === 100 ? "Saving…" : `Baking ${bakePercent}%`}
								</span>
							) : null}
							<Tooltip
								content={bakeTitle}
								contentClassName="z-50"
							>
								<LinkButton
									className="relative isolate inline-flex size-9 shrink-0 items-center justify-center overflow-hidden no-underline hover:no-underline"
									cursorIntent={bakePending ? "progress" : undefined}
									data-ui="TilePaintingBakeAll"
									disabled={
										busy ||
										loading ||
										!paintings.some(
											(painting) => painting.outputResourceId !== null,
										)
									}
									onClick={bakeAllFn}
								>
									{bakePending ? (
										<span
											className="absolute inset-y-0 left-0 z-0 bg-accent/20 transition-[width] duration-200 ease-linear"
											data-ui="TilePaintingBakeProgress"
											style={{
												width: `${bakePercent}%`,
											}}
										/>
									) : null}
									<span className="relative z-10 inline-flex items-center gap-2">
										<RefreshCw className="size-4" />
									</span>
								</LinkButton>
							</Tooltip>
							<Tooltip
								content="New painting"
								contentClassName="z-50"
							>
								<LinkButton
									className="inline-flex size-9 items-center justify-center no-underline hover:no-underline"
									disabled={busy}
									onClick={() => setCreateOpenFn(true)}
								>
									<Plus className="size-4" />
								</LinkButton>
							</Tooltip>
							<EditorPageHelp
								title="Tile painter"
								content={
									<>
										<p>
											Combine textures from Assets into terrain tiles. Paint
											layer masks to shape the ground, soften edges, add
											shadows and scatter decorations. Original images stay
											untouched.
										</p>
										<p>
											Create a painting, choose textures in Layers, then draw
											in Canvas. Preview lets you check how tiles connect.
										</p>
										<p>
											Save keeps the editable setup. Bake creates its PNG in
											Assets. Bake all refreshes every existing output from
											the latest source images; paintings without an output
											are skipped.
										</p>
									</>
								}
							/>
						</div>
					}
				/>
			}
		>
			<div
				className="relative grid gap-4"
				data-ui="TilePaintingLibrary"
			>
				{error !== null || bakeError !== null ? (
					<p className="absolute inset-x-0 top-0 z-10 rounded-lg border border-danger bg-surface p-3 text-sm text-danger">
						{error ?? bakeError}
					</p>
				) : null}
				{loading && paintings.length === 0 ? (
					<p className="text-sm text-muted">Loading paintings…</p>
				) : paintings.length === 0 ? (
					<Status
						dataUi="TilePaintingLibraryEmpty"
						variant="flat"
						icon={Paintbrush}
						title="No paintings yet"
						description="Create a terrain tile from your Assets. Paint its shape, add details, then bake it into a new asset."
						action={
							<LinkButton
								className="inline-flex min-h-9 items-center gap-2"
								disabled={busy}
								onClick={() => setCreateOpenFn(true)}
							>
								<Plus className="size-4" />
								Create first painting
							</LinkButton>
						}
					/>
				) : (
					<div className="ak-list grid gap-2">
						{paintings.map((painting) => (
							<article
								key={painting.paintingId}
								data-ui="TilePaintingLibraryEntry"
								className="ak-list-row grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 rounded-xl px-4 py-3"
							>
								<div className="row-span-2">
									{painting.outputResourceId !== null ? (
										<EditorAssetThumbnail
											resourceId={painting.outputResourceId}
										/>
									) : (
										<Paintbrush className="size-9 text-accent" />
									)}
								</div>
								<h2 className="min-w-0">
									<LinkButtonLink
										to="/editor/$projectId/painter/$paintingId/canvas"
										params={{
											projectId: project.projectId,
											paintingId: painting.paintingId,
										}}
										className="block truncate font-semibold"
									>
										{painting.document.name}
									</LinkButtonLink>
								</h2>
								<Tooltip
									content="Delete painting"
									contentClassName="z-50"
								>
									<LinkButton
										className="inline-flex size-9 items-center justify-center no-underline hover:no-underline"
										disabled={busy}
										onClick={() => setDeleteCandidateFn(painting)}
									>
										<Trash2 className="size-4" />
									</LinkButton>
								</Tooltip>
								<Tooltip
									content="Open painting"
									contentClassName="z-50"
								>
									<LinkButtonLink
										to="/editor/$projectId/painter/$paintingId/canvas"
										params={{
											projectId: project.projectId,
											paintingId: painting.paintingId,
										}}
										className="inline-flex size-9 items-center justify-center no-underline hover:no-underline"
									>
										<ChevronRight className="size-4" />
									</LinkButtonLink>
								</Tooltip>
								<p className="col-start-2 text-xs text-muted">
									{TilePaintingCanvasSize} × {TilePaintingCanvasSize} ·{" "}
									{painting.document.layers.length} layers
								</p>
							</article>
						))}
					</div>
				)}
			</div>
			{createOpen ? (
				<TilePaintingDialog
					title="New painting"
					onCloseFn={() => {
						if (!busy) setCreateOpenFn(false);
					}}
				>
					<EditorTextControl
						label="Name"
						value={name}
						onChangeFn={setNameFn}
					/>

					<p className="text-xs text-muted">
						Fixed 1254 × 1254 px canvas viewed from above, matching our generated
						artwork.
					</p>
					{error !== null ? <p className="text-sm text-danger">{error}</p> : null}
					<PrimaryButton
						className="min-h-9 justify-self-end gap-2 px-3 py-1.5 text-sm"
						disabled={busy || name.trim() === ""}
						onClick={() => void createFn()}
					>
						<Check className="size-4" />
						{busy ? "Creating…" : "Create painting"}
					</PrimaryButton>
				</TilePaintingDialog>
			) : null}
			{deleteCandidate !== null ? (
				<TilePaintingDialog
					title="Delete painting"
					onCloseFn={() => {
						if (!busy) setDeleteCandidateFn(null);
					}}
				>
					<p className="text-sm text-muted">
						Delete “{deleteCandidate.document.name}” and its editable recipe? Its baked
						asset stays in Assets. This cannot be undone in the painter.
					</p>
					{error !== null ? <p className="text-sm text-danger">{error}</p> : null}
					<Tooltip
						content="Delete painting"
						contentClassName="z-50"
					>
						<LinkButton
							className="inline-flex size-9 items-center justify-center justify-self-end no-underline hover:no-underline"
							disabled={busy}
							onClick={() => void deleteFn()}
						>
							<Trash2 className="size-5" />
						</LinkButton>
					</Tooltip>
				</TilePaintingDialog>
			) : null}
		</EditorSectionPage>
	);
};
