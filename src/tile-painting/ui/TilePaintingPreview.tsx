import { Tooltip } from "~/ui/ui/Tooltip";
import { TilePaintingCanvasSize } from "~/tile-painting/constant/TilePaintingCanvasSize";
import { useEffect, useState } from "react";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { renderTilePaintingPngFx } from "~/tile-painting/fx/renderTilePaintingPngFx";
import { useTilePaintingSession } from "~/tile-painting/ui/useTilePaintingSession";
import { TilePaintingImagePicker } from "~/tile-painting/ui/TilePaintingImagePicker";
import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";
import { editorInputClassName } from "~/editor-control/constant/EditorInputClassName";
import { LinkButton } from "~/ui/ui/LinkButton";
import { Image as ImageIcon, Eraser, Scan, Shrink } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

/** Compares seam-adjacent tiles at source resolution; preview arrangement never enters the baked asset. */
export const TilePaintingPreview = () => {
	const session = useTilePaintingSession();
	const painting = session.document;
	const [png, setPngFn] = useState<string>();
	const [renderError, setRenderErrorFn] = useState<string>();
	const [selectedCell, setSelectedCellFn] = useState(0);
	const [cellWidth, setCellWidthFn] = useState(256);
	const [palette, setPaletteFn] = useState<
		TilePaintingDocumentSchema.Type["preview"]["cells"][number]
	>({
		kind: "painting",
	});
	useEffect(() => {
		const abort = new AbortController();
		setPngFn(undefined);
		setRenderErrorFn(undefined);
		void RendererRuntime.runPromise(renderTilePaintingPngFx(painting), {
			signal: abort.signal,
		})
			.then((value) => {
				if (!abort.signal.aborted) setPngFn(value);
			})
			.catch((cause) => {
				if (!abort.signal.aborted)
					setRenderErrorFn(cause instanceof Error ? cause.message : String(cause));
			});
		return () => abort.abort();
	}, [
		painting.images,
		painting.layers,
		painting.scatter,
	]);
	const activeCell = Math.min(selectedCell, painting.preview.cells.length - 1);
	const resizeFn = (columns: number, rows: number) =>
		session.editFn({
			...painting,
			preview: {
				columns,
				rows,
				cells: Array.from(
					{
						length: columns * rows,
					},
					(_, index) => {
						const x = index % columns;
						const y = Math.floor(index / columns);
						return x < painting.preview.columns && y < painting.preview.rows
							? painting.preview.cells[y * painting.preview.columns + x]
							: null;
					},
				),
			},
		});
	const setCellFn = (index: number, cell: typeof palette) =>
		session.editFn({
			...painting,
			preview: {
				...painting.preview,
				cells: painting.preview.cells.map((previous, candidate) =>
					candidate === index ? cell : previous,
				),
			},
		});
	const imagePalette = painting.images.filter((image) =>
		painting.preview.cells.some((cell) => cell?.kind === "image" && cell.imageId === image.id),
	);
	const usablePalette =
		palette?.kind === "image" && !painting.images.some((image) => image.id === palette.imageId)
			? {
					kind: "painting" as const,
				}
			: palette;
	return (
		<div
			className="flex h-full min-h-0 flex-col"
			data-ui="TilePaintingPreview"
		>
			<fieldset
				disabled={session.busy}
				className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-3 py-2"
				data-ui="TilePaintingPreviewToolbar"
			>
				<div className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
					<span>Grid</span>
					<input
						type="number"
						title="Grid columns"
						className={twMerge(editorInputClassName, "min-h-8 w-12 px-2 py-1 text-xs")}
						min={1}
						max={8}
						step={1}
						value={painting.preview.columns}
						onChange={(event) => {
							const value = event.currentTarget.valueAsNumber;
							if (Number.isFinite(value))
								resizeFn(
									Math.max(1, Math.min(8, Math.round(value))),
									painting.preview.rows,
								);
						}}
					/>
					<span>×</span>
					<input
						type="number"
						title="Grid rows"
						className={twMerge(editorInputClassName, "min-h-8 w-12 px-2 py-1 text-xs")}
						min={1}
						max={8}
						step={1}
						value={painting.preview.rows}
						onChange={(event) => {
							const value = event.currentTarget.valueAsNumber;
							if (Number.isFinite(value))
								resizeFn(
									painting.preview.columns,
									Math.max(1, Math.min(8, Math.round(value))),
								);
						}}
					/>
					<EditorInfoTooltip
						content={
							<div className="grid gap-2">
								<p>
									Choose a tile from the palette, then click grid cells to place
									it. Use the asset picker to replace the selected cell and add
									that asset to the palette.
								</p>
								<p>
									Tiles touch without gaps so you can inspect seams. The live
									painting is {TilePaintingCanvasSize} × {TilePaintingCanvasSize}{" "}
									px; 1:1 shows its original pixels. The grid and guide image
									never enter the baked asset.
								</p>
							</div>
						}
					/>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<label className="flex items-center gap-2 text-xs text-muted">
						Zoom
						<input
							type="range"
							className="w-24"
							min={64}
							max={2048}
							step={1}
							value={cellWidth}
							onChange={(event) => setCellWidthFn(event.currentTarget.valueAsNumber)}
						/>
						<span className="w-9 text-right tabular-nums">
							{Math.round((cellWidth / TilePaintingCanvasSize) * 100)}%
						</span>
					</label>
					<Tooltip
						content="1:1 pixels"
						contentClassName="z-50"
					>
						<LinkButton
							className="inline-flex size-7 items-center justify-center"
							onClick={() => setCellWidthFn(TilePaintingCanvasSize)}
						>
							<Scan className="size-4" />
						</LinkButton>
					</Tooltip>
					<Tooltip
						content="Compact preview"
						contentClassName="z-50"
					>
						<LinkButton
							className="inline-flex size-7 items-center justify-center"
							onClick={() => setCellWidthFn(256)}
						>
							<Shrink className="size-4" />
						</LinkButton>
					</Tooltip>
				</div>
				<div
					className="flex min-w-0 flex-wrap items-center gap-1"
					data-ui="TilePaintingPreviewPalettes"
				>
					<Tooltip
						content="Place current painting"
						contentClassName="z-50"
					>
						<LinkButton
							className="inline-flex size-8 shrink-0 items-center justify-center opacity-50 data-[ui-selected=true]:opacity-100"
							{...readDataUiFn({
								dataUi: "TilePaintingPreviewPalette",
								state: {
									selected: usablePalette?.kind === "painting",
								},
							})}
							onClick={() =>
								setPaletteFn({
									kind: "painting",
								})
							}
						>
							{png === undefined ? (
								<ImageIcon className="size-5" />
							) : (
								<img
									className="size-7 object-contain"
									src={png}
								/>
							)}
						</LinkButton>
					</Tooltip>
					{imagePalette.map((image) => (
						<Tooltip
							key={image.id}
							content={`Place ${image.label}`}
							contentClassName="z-50"
						>
							<LinkButton
								className="inline-flex size-8 shrink-0 items-center justify-center opacity-50 data-[ui-selected=true]:opacity-100"
								{...readDataUiFn({
									dataUi: "TilePaintingPreviewPalette",
									state: {
										selected:
											usablePalette?.kind === "image" &&
											usablePalette.imageId === image.id,
									},
								})}
								onClick={() =>
									setPaletteFn({
										kind: "image",
										imageId: image.id,
									})
								}
							>
								<img
									className="size-7 object-contain"
									src={image.png}
								/>
							</LinkButton>
						</Tooltip>
					))}
					<Tooltip
						content="Place empty cell"
						contentClassName="z-50"
					>
						<LinkButton
							className="inline-flex size-8 shrink-0 items-center justify-center opacity-50 data-[ui-selected=true]:opacity-100"
							{...readDataUiFn({
								dataUi: "TilePaintingPreviewPalette",
								state: {
									selected: usablePalette === null,
								},
							})}
							onClick={() => setPaletteFn(null)}
						>
							<Eraser className="size-4" />
						</LinkButton>
					</Tooltip>
				</div>
				<TilePaintingImagePicker
					compact
					label={`Asset for cell ${activeCell + 1}`}
					applyFn={(document, imageId) => {
						const cell = {
							kind: "image" as const,
							imageId,
						};
						setPaletteFn(cell);
						return {
							...document,
							preview: {
								...document.preview,
								cells: document.preview.cells.map((previous, index) =>
									index === activeCell ? cell : previous,
								),
							},
						};
					}}
				/>
			</fieldset>
			{renderError !== undefined ? (
				<p className="p-3 text-sm text-danger">{renderError}</p>
			) : null}
			<div
				className="min-h-0 flex-1 overflow-auto bg-canvas p-6"
				data-ui="TilePaintingPreviewViewport"
			>
				<div
					className="mx-auto grid w-max"
					style={{
						gridTemplateColumns: `repeat(${painting.preview.columns}, ${cellWidth}px)`,
					}}
				>
					{painting.preview.cells.map((cell, index) => {
						const source =
							cell?.kind === "painting"
								? png
								: cell?.kind === "image"
									? painting.images.find((image) => image.id === cell.imageId)
											?.png
									: undefined;
						return (
							<button
								key={index}
								type="button"
								className="relative block cursor-pointer overflow-hidden bg-surface p-0 leading-none data-[ui-selected=true]:z-10 data-[ui-selected=true]:outline data-[ui-selected=true]:-outline-offset-1 data-[ui-selected=true]:outline-accent"
								style={{
									width: cellWidth,
									height: cellWidth,
								}}
								disabled={session.busy}
								title={`Cell ${index + 1} · click to place selected tile`}
								{...readDataUiFn({
									dataUi: "TilePaintingPreviewCell",
									state: {
										selected: index === activeCell,
									},
								})}
								onClick={() => {
									setSelectedCellFn(index);
									setCellFn(index, usablePalette);
								}}
							>
								{source !== undefined ? (
									<img
										className="block size-full object-contain"
										draggable={false}
										src={source}
									/>
								) : (
									<span className="text-xs text-muted">
										{cell?.kind === "painting" ? "Rendering…" : "Empty"}
									</span>
								)}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
};
