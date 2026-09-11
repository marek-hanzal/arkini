import { Tooltip } from "~/ui/ui/Tooltip";
import { LinkButton } from "~/ui/ui/LinkButton";
import { useState } from "react";
import {
	Brush,
	Eraser,
	Flower2,
	Settings2,
	Scan,
	Waves,
	Circle,
	Layers,
	Square,
	Image as ImageIcon,
} from "lucide-react";
import { TilePaintingCanvas } from "~/tile-painting/ui/TilePaintingCanvas";
import { TilePaintingDialog } from "~/tile-painting/ui/TilePaintingDialog";
import { TilePaintingImagePicker } from "~/tile-painting/ui/TilePaintingImagePicker";
import {
	useTilePaintingSession,
	useTilePaintingSessionRuntime,
} from "~/tile-painting/ui/useTilePaintingSession";
import { EditorNumberControl } from "~/editor-control/ui/EditorValueControls";
import { EditorSelect } from "~/editor-control/ui/EditorSelect";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

const tools = [
	{
		id: "reveal",
		label: "Reveal · B — Paint the texture into the mask.",
		icon: Brush,
	},
	{
		id: "hide",
		label: "Erase · E — Remove opacity from the mask, down to full transparency.",
		icon: Eraser,
	},
	{
		id: "smooth",
		label: "Smooth · M — Soften mask transitions.",
		icon: Waves,
	},
	{
		id: "scatter",
		label: "Scatter · S — Place decorations from the enabled palette using their weights.",
		icon: Flower2,
	},
] as const;

export const TilePaintingCanvasPage = () => {
	const session = useTilePaintingSession();
	const runtime = useTilePaintingSessionRuntime();
	const [settingsOpen, setSettingsOpenFn] = useState(false);
	const selectedLayerId = session.document.layers.some(
		(layer) => layer.id === session.activeLayerId,
	)
		? session.activeLayerId
		: (session.document.layers.at(-1)?.id ?? null);
	return (
		<div
			className="flex h-full min-h-0 flex-col"
			data-ui="TilePaintingCanvasPage"
		>
			<fieldset
				disabled={session.busy}
				className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2"
			>
				{tools.map((tool) => (
					<Tooltip
						key={tool.id}
						content={tool.label}
						contentClassName="z-50"
					>
						<LinkButton
							className="inline-flex size-9 items-center justify-center text-muted no-underline hover:no-underline data-[ui-selected=true]:text-accent border-b-2 border-transparent data-[ui-selected=true]:border-accent"
							{...readDataUiFn({
								dataUi: "TilePaintingTool",
								state: {
									selected: session.tool === tool.id,
								},
							})}
							onClick={() => session.setToolFn(tool.id)}
						>
							<tool.icon className="size-4" />
						</LinkButton>
					</Tooltip>
				))}
				<Tooltip
					content={
						session.paintAllLayers
							? "All layers · A — Painting affects every layer mask. Click to use only the active layer."
							: "Active layer · A — Painting affects only this layer. Click to paint every layer mask."
					}
					contentClassName="z-50"
				>
					<LinkButton
						className="inline-flex size-9 items-center justify-center border-b-2 border-transparent text-muted no-underline hover:no-underline data-[ui-selected=true]:border-accent data-[ui-selected=true]:text-accent"
						disabled={session.tool === "scatter"}
						{...readDataUiFn({
							dataUi: "TilePaintingAllLayers",
							state: {
								selected: session.paintAllLayers,
							},
						})}
						onClick={() => session.setPaintAllLayersFn(!session.paintAllLayers)}
					>
						<Layers className="size-4" />
					</LinkButton>
				</Tooltip>
				<EditorSelect
					label="Active layer"
					className="w-80 shrink-0"
					size="control"
					variant="link"
					value={selectedLayerId ?? ""}
					options={
						session.document.layers.length === 0
							? [
									{
										value: "",
										label: "Add a texture in Layers",
									},
								]
							: [
									...session.document.layers,
								]
									.reverse()
									.map((layer) => ({
										value: layer.id,
										label: `${layer.name}${layer.visible ? "" : " (hidden)"}`,
									}))
					}
					onChangeFn={session.setActiveLayerIdFn}
				/>
				<Tooltip
					content={`Tool settings — Adjust brush shape, size and strength, or the scatter palette. Current size: ${Math.round(session.brush.size)} px.`}
					contentClassName="z-50"
				>
					<LinkButton
						className="inline-flex size-9 items-center justify-center no-underline hover:no-underline"
						onClick={() => setSettingsOpenFn(true)}
					>
						<Settings2 className="size-4" />
					</LinkButton>
				</Tooltip>
				<Tooltip
					content="Reset view · 0 — Restore the original zoom and canvas position."
					contentClassName="z-50"
				>
					<LinkButton
						className="inline-flex items-center justify-center ml-auto size-9 shrink-0 no-underline hover:no-underline"
						onClick={() =>
							session.setViewFn({
								zoom: 1,
								panX: 0,
								panY: 0,
							})
						}
					>
						<Scan className="size-4" />
					</LinkButton>
				</Tooltip>
				<label className="flex items-center gap-2 text-xs text-muted">
					Preview
					<input
						type="range"
						min={0.1}
						max={1}
						step={0.05}
						value={session.previewOpacity}
						onChange={(event) =>
							session.setPreviewOpacityFn(event.currentTarget.valueAsNumber)
						}
					/>
					<span className="w-8">{Math.round(session.previewOpacity * 100)}%</span>
				</label>
				<label className="flex items-center gap-2 text-xs">
					<input
						type="checkbox"
						checked={session.referenceOnly}
						onChange={(event) =>
							session.setReferenceOnlyFn(event.currentTarget.checked)
						}
					/>
					Reference only
				</label>
			</fieldset>
			<div className="relative min-h-0 flex-1">
				<TilePaintingCanvas
					session={runtime}
					suspended={settingsOpen}
				/>
			</div>
			{settingsOpen ? (
				<TilePaintingDialog
					title={
						session.tool === "scatter"
							? "Scatter brush"
							: session.tool === "smooth"
								? "Smooth mask"
								: "Mask brush"
					}
					onCloseFn={() => setSettingsOpenFn(false)}
				>
					<EditorNumberControl
						label="Brush size (px)"
						min={1}
						max={1024}
						value={session.brush.size}
						onChangeFn={(value) => {
							if (Number.isFinite(value))
								session.setBrushFn({
									...session.brush,
									size: Math.max(1, Math.min(1024, value)),
								});
						}}
					/>
					{session.tool === "scatter" ? (
						<>
							<EditorNumberControl
								label="Spacing (px)"
								description="Distance along the stroke between scattered images. Smaller values make a denser brush."
								min={2}
								max={512}
								value={session.scatterSpacing}
								onChangeFn={(value) => {
									if (Number.isFinite(value))
										session.setScatterSpacingFn(
											Math.max(2, Math.min(512, value)),
										);
								}}
							/>
							<div className="grid gap-2">
								<h3 className="text-sm font-semibold">Active palette</h3>
								{session.document.catalog.length === 0 ? (
									<p className="text-sm text-muted">
										Add images in the Scattering tab first.
									</p>
								) : (
									session.document.catalog.map((entry) => {
										const image = session.document.images.find(
											(image) => image.id === entry.imageId,
										);
										return (
											<label
												key={entry.id}
												className="flex cursor-pointer items-center gap-3 rounded-lg border border-line p-2"
											>
												<input
													type="checkbox"
													checked={entry.enabled}
													onChange={(event) =>
														session.editFn({
															...session.document,
															catalog: session.document.catalog.map(
																(candidate) =>
																	candidate.id === entry.id
																		? {
																				...candidate,
																				enabled:
																					event
																						.currentTarget
																						.checked,
																			}
																		: candidate,
															),
														})
													}
												/>
												<img
													className="size-10 object-contain"
													src={image?.png}
												/>
												<span className="min-w-0 flex-1 truncate text-sm">
													{image?.label}
												</span>
												<span className="text-xs text-muted">
													{entry.minSize}–{entry.maxSize} px
												</span>
											</label>
										);
									})
								)}
							</div>
						</>
					) : (
						<>
							{session.tool === "smooth" ? (
								<p className="text-sm text-muted">
									Blend neighboring mask opacity inside the brush to soften
									transitions. Strength controls how much smoothing is applied.
								</p>
							) : null}
							<div className="flex items-center gap-2">
								<span className="mr-2 text-sm font-semibold">Brush shape</span>
								{(
									[
										{
											shape: "circle",
											label: "Circle",
											icon: Circle,
										},
										{
											shape: "square",
											label: "Square",
											icon: Square,
										},
										{
											shape: "image",
											label: "Image alpha",
											icon: ImageIcon,
										},
									] as const
								).map(({ shape, label, icon: Icon }) => (
									<Tooltip
										key={shape}
										content={label}
										contentClassName="z-50"
									>
										<LinkButton
											className="inline-flex size-9 items-center justify-center border-b-2 border-transparent text-muted no-underline hover:no-underline data-[ui-selected=true]:border-accent data-[ui-selected=true]:text-accent"
											{...readDataUiFn({
												dataUi: "TilePaintingBrushShape",
												state: {
													selected: session.brush.shape === shape,
												},
											})}
											onClick={() =>
												session.setBrushFn({
													...session.brush,
													shape,
												})
											}
										>
											<Icon className="size-4" />
										</LinkButton>
									</Tooltip>
								))}
							</div>
							<div className="grid grid-cols-2 gap-3">
								<EditorNumberControl
									label="Strength (%)"
									min={1}
									max={100}
									value={Math.round(session.brush.opacity * 100)}
									onChangeFn={(value) => {
										if (Number.isFinite(value))
											session.setBrushFn({
												...session.brush,
												opacity: Math.max(1, Math.min(100, value)) / 100,
											});
									}}
								/>
								<EditorNumberControl
									label="Hardness (%)"
									min={0}
									max={100}
									value={Math.round(session.brush.hardness * 100)}
									onChangeFn={(value) => {
										if (Number.isFinite(value))
											session.setBrushFn({
												...session.brush,
												hardness: Math.max(0, Math.min(100, value)) / 100,
											});
									}}
								/>
							</div>
							{session.brush.shape === "image" ? (
								<>
									{session.brush.brushImageId !== null ? (
										<img
											className="mx-auto size-20 object-contain"
											src={
												session.document.images.find(
													(image) =>
														image.id === session.brush.brushImageId,
												)?.png
											}
										/>
									) : null}
									<TilePaintingImagePicker
										label="Brush stamp asset"
										description="The PNG alpha defines the stamp; its colors are ignored."
										applyFn={(document, imageId) => {
											session.setBrushFn({
												...session.brush,
												brushImageId: imageId,
											});
											return document;
										}}
									/>
								</>
							) : null}
						</>
					)}
				</TilePaintingDialog>
			) : null}
		</div>
	);
};
