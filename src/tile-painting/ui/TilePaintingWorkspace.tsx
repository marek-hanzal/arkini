import { Tooltip } from "~/ui/ui/Tooltip";
import { TilePaintingCanvasSize } from "~/tile-painting/constant/TilePaintingCanvasSize";
import { LinkButton, LinkButtonLink } from "~/ui/ui/LinkButton";
import { useEffect, useEffectEvent, useState, type PropsWithChildren } from "react";
import { useLocation } from "@tanstack/react-router";
import { Save, Undo2, Redo2, ImagePlus, Check, X } from "lucide-react";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionTabs } from "~/authoring-shell/ui/EditorSectionTabs";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorTextControl } from "~/editor-control/ui/EditorValueControls";
import { TilePaintingDialog } from "~/tile-painting/ui/TilePaintingDialog";
import {
	useTilePaintingSession,
	useTilePaintingSessionRuntime,
} from "~/tile-painting/ui/useTilePaintingSession";

const tabs = [
	{
		label: "Canvas",
		to: "/editor/$projectId/painter/$paintingId/canvas",
	},
	{
		label: "Layers",
		to: "/editor/$projectId/painter/$paintingId/layers",
	},
	{
		label: "Scattering",
		to: "/editor/$projectId/painter/$paintingId/scattering",
	},
	{
		label: "Preview",
		to: "/editor/$projectId/painter/$paintingId/preview",
	},
] as const;

const TilePaintingHelp = () => (
	<EditorPageHelp
		title="Tile painter"
		content={
			<>
				<p>
					The canvas is {TilePaintingCanvasSize} × {TilePaintingCanvasSize} px. Layers are
					listed from top to bottom and new layers start hidden by their masks. Layers
					hold repeating textures. Reveal or erase their masks; the original images stay
					intact. Strength gradually adds or removes visibility; Smooth softens existing
					mask transitions. Higher layers cover lower layers. Scatter decorations are
					placed above the texture layers. Each layer’s Shadow controls tune shading on
					lower terrain; transparent areas stay clear. Canvas shadows refresh shortly
					after you finish drawing.
				</p>
				<p>
					Erase at 100% strength clears the solid brush core completely. Soft edges keep
					smooth transitions. Clear every layer at a point to make it fully transparent;
					there is no permanent background in the baked PNG.
				</p>
				<p>
					Scatter weights are relative: 200% is twice as likely as 100%; 0% excludes the
					decoration. Weights affect new strokes; existing placements stay unchanged.
				</p>
				<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
					<dt className="font-mono text-foreground">Drag</dt>
					<dd>Paint one stroke. One stroke = one undo step.</dd>
					<dt className="font-mono text-foreground">B / E / M / S</dt>
					<dd>Reveal / erase / smooth mask / scatter.</dd>
					<dt className="font-mono text-foreground">A</dt>
					<dd>
						Toggle active/all layers. All includes hidden layers; one stroke is one
						undo.
					</dd>
					<dt className="font-mono text-foreground">[ / ]</dt>
					<dd>Decrease / increase brush size.</dd>
					<dt className="font-mono text-foreground">Wheel</dt>
					<dd>Zoom around the pointer.</dd>
					<dt className="font-mono text-foreground">Space + drag</dt>
					<dd>Pan. Middle-button drag also works.</dd>
					<dt className="font-mono text-foreground">Esc</dt>
					<dd>Cancel the current stroke or close a dialog.</dd>
					<dt className="font-mono text-foreground">⌘/Ctrl Z</dt>
					<dd>Undo; add Shift to redo. Ctrl Y also redoes.</dd>
					<dt className="font-mono text-foreground">⌘/Ctrl S</dt>
					<dd>Save the editable painting.</dd>
					<dt className="font-mono text-foreground">0</dt>
					<dd>Reset the canvas view.</dd>
				</dl>
				<p>
					The reference image is aligned to the canvas behind the painting. Reference only
					shows this guide; lower Preview opacity to trace through textures. Neither
					setting nor the reference enters the baked PNG.
				</p>
				<p>
					Save keeps the editable recipe. Bake asset also writes a transparent PNG into
					Assets. Preview arranges selected assets and the live painting in a seamless
					grid; 1:1 pixels shows the original resolution. Switching tabs preserves your
					draft and the last 100 undo steps. Shortcuts pause while typing or using
					dialogs.
				</p>
			</>
		}
	/>
);

/** Routes replace tab content; this parent retains the document session and common commands. */
export const TilePaintingWorkspace = ({ children }: PropsWithChildren) => {
	const session = useTilePaintingSession();
	const runtime = useTilePaintingSessionRuntime();
	const project = useEditorProject();
	const pathname = useLocation({
		select: (location) => location.pathname,
	});
	const canvasActive = pathname.endsWith("/canvas");
	const [bakeOpen, setBakeOpenFn] = useState(false);
	const [outputId, setOutputIdFn] = useState(
		session.outputResourceId ??
			session.document.name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, ""),
	);
	const onKeyDownFn = useEffectEvent((event: KeyboardEvent) => {
		const current = runtime.readFn();
		if (
			event.defaultPrevented ||
			current.busy ||
			(event.target instanceof HTMLElement &&
				event.target.closest("input, textarea, select, [contenteditable=true]") !== null)
		)
			return;
		if (
			document.querySelector(
				'[data-ui="TilePaintingDialog"], [data-ui="EditorPageHelpDialog"], [data-ui="EditorSelectMenu"]',
			) !== null
		)
			return;
		const key = event.key.toLowerCase();
		if (event.metaKey || event.ctrlKey) {
			if (event.altKey) return;
			if (key === "z") {
				event.preventDefault();
				if (event.shiftKey) session.redoFn();
				else session.undoFn();
			} else if (key === "y") {
				event.preventDefault();
				session.redoFn();
			} else if (key === "s" && !event.shiftKey) {
				event.preventDefault();
				void session.saveFn();
			}
			return;
		}
		if (!canvasActive || event.altKey) return;
		if (key === "b" || key === "e" || key === "m" || key === "s") {
			event.preventDefault();
			session.setToolFn(
				key === "b" ? "reveal" : key === "e" ? "hide" : key === "m" ? "smooth" : "scatter",
			);
		} else if (key === "a" && current.tool !== "scatter" && !event.repeat) {
			event.preventDefault();
			session.setPaintAllLayersFn(!current.paintAllLayers);
		} else if (key === "[" || key === "]") {
			event.preventDefault();
			session.setBrushFn({
				...current.brush,
				size: Math.max(
					1,
					Math.min(1024, Math.round(current.brush.size * (key === "[" ? 0.8 : 1.25))),
				),
			});
		} else if (key === "0") {
			event.preventDefault();
			session.setViewFn({
				zoom: 1,
				panX: 0,
				panY: 0,
			});
		}
	});
	useEffect(() => {
		window.addEventListener("keydown", onKeyDownFn);
		return () => window.removeEventListener("keydown", onKeyDownFn);
	}, []);
	return (
		<EditorSectionPage
			contentMode="viewport"
			header={
				<EditorSectionNavigation
					leading={
						<EditorHistoryBackButton
							to="/editor/$projectId/painter"
							params={{
								projectId: project.projectId,
							}}
						/>
					}
					tabs={
						<EditorSectionTabs>
							{tabs.map((tab) => (
								<LinkButtonLink
									key={tab.to}
									to={tab.to}
									params={{
										projectId: project.projectId,
										paintingId: session.paintingId,
									}}
									activeOptions={{
										exact: true,
									}}
									activeProps={{
										"data-ui-selected": true,
									}}
									inactiveProps={{
										"data-ui-selected": false,
									}}
									className="inline-flex h-9 items-center border-b-2 border-transparent px-2 text-sm text-muted hover:no-underline data-[ui-selected=true]:border-accent data-[ui-selected=true]:font-semibold data-[ui-selected=true]:text-accent"
								>
									{tab.label}
								</LinkButtonLink>
							))}
						</EditorSectionTabs>
					}
					title={
						<span className="text-sm font-semibold">
							{session.document.name}
							{session.dirty ? " · unsaved" : ""}
						</span>
					}
					action={
						<div className="flex items-center gap-2">
							<Tooltip
								content="Undo · Mod+Z"
								contentClassName="z-50"
							>
								<LinkButton
									className="inline-flex items-center justify-center size-9 shrink-0 no-underline hover:no-underline"
									disabled={session.busy || !session.canUndo}
									onClick={session.undoFn}
								>
									<Undo2 className="size-4" />
								</LinkButton>
							</Tooltip>
							<Tooltip
								content="Redo · Mod+Shift+Z"
								contentClassName="z-50"
							>
								<LinkButton
									className="inline-flex items-center justify-center size-9 shrink-0 no-underline hover:no-underline"
									disabled={session.busy || !session.canRedo}
									onClick={session.redoFn}
								>
									<Redo2 className="size-4" />
								</LinkButton>
							</Tooltip>
							<Tooltip
								content="Save · Mod+S — Save the editable recipe."
								contentClassName="z-50"
							>
								<LinkButton
									className="inline-flex size-9 items-center justify-center no-underline hover:no-underline"
									disabled={session.busy}
									onClick={() => void session.saveFn()}
								>
									<Save className="size-4" />
								</LinkButton>
							</Tooltip>
							<Tooltip
								content="Bake asset — Render the painting into an asset using current source images."
								contentClassName="z-50"
							>
								<LinkButton
									className="inline-flex size-9 items-center justify-center no-underline hover:no-underline"
									disabled={session.busy}
									onClick={() => setBakeOpenFn(true)}
								>
									<ImagePlus className="size-4" />
								</LinkButton>
							</Tooltip>
							<TilePaintingHelp />
						</div>
					}
				/>
			}
		>
			<div
				className="relative flex h-full min-h-0 flex-col"
				data-ui="TilePaintingWorkspace"
			>
				{session.error !== null ? (
					<div className="absolute inset-x-3 top-3 z-30 flex items-center gap-3 rounded-xl border border-danger/30 bg-surface-raised px-4 py-2 text-sm text-danger shadow-lg">
						<span className="flex-1">{session.error}</span>
						<Tooltip
							content="Dismiss error"
							contentClassName="z-50"
						>
							<LinkButton
								className="inline-flex size-7 items-center justify-center"
								onClick={() => session.setErrorFn(null)}
							>
								<X className="size-4" />
							</LinkButton>
						</Tooltip>
					</div>
				) : null}

				<div className="min-h-0 flex-1 overflow-auto">{children}</div>
			</div>
			{bakeOpen ? (
				<TilePaintingDialog
					title="Bake asset"
					onCloseFn={() => {
						if (!session.busy) setBakeOpenFn(false);
					}}
				>
					<p className="text-sm text-muted">
						Save the editable painting and bake its visible layers and decorations into
						one transparent PNG. The reference is excluded.
					</p>
					<EditorTextControl
						label="Asset ID"
						value={outputId}
						onChangeFn={setOutputIdFn}
					/>
					<p className="text-xs text-muted">
						{session.outputResourceId === outputId
							? "This replaces the asset previously baked by this painting."
							: "Choose a new asset ID. Existing unrelated assets are protected."}
					</p>
					<Tooltip
						content={session.busy ? "Saving…" : "Save and bake"}
						contentClassName="z-50"
					>
						<LinkButton
							className="inline-flex size-9 items-center justify-center justify-self-end"
							disabled={session.busy || outputId.trim() === ""}
							onClick={() =>
								void session.saveFn(outputId.trim()).then((saved) => {
									if (saved) setBakeOpenFn(false);
								})
							}
						>
							<Check className="size-5" />
						</LinkButton>
					</Tooltip>
				</TilePaintingDialog>
			) : null}
		</EditorSectionPage>
	);
};
