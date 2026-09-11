import { Tooltip } from "~/ui/ui/Tooltip";
import { LinkButton } from "~/ui/ui/LinkButton";
import { useState } from "react";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";
import { TilePaintingDefaultShadow } from "~/tile-painting/constant/TilePaintingDefaultShadow";
import { TilePaintingDialog } from "~/tile-painting/ui/TilePaintingDialog";
import { createId } from "@paralleldrive/cuid2";
import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2, Sun, X } from "lucide-react";
import { useTilePaintingSession } from "~/tile-painting/ui/useTilePaintingSession";
import { TilePaintingImagePicker } from "~/tile-painting/ui/TilePaintingImagePicker";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { EditorNumberControl, EditorTextControl } from "~/editor-control/ui/EditorValueControls";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

export const TilePaintingLayers = () => {
	const session = useTilePaintingSession();
	const painting = session.document;
	return (
		<fieldset
			disabled={session.busy}
			className="grid min-w-0 content-start gap-4 p-4"
			data-ui="TilePaintingLayers"
		>
			<EditorRootCard className="items-start md:grid-cols-2">
				<EditorTextControl
					label="Painting name"
					value={painting.name}
					onChangeFn={(name) =>
						session.editFn({
							...painting,
							name,
						})
					}
				/>
				<div className="grid min-w-0 gap-3">
					<TilePaintingImagePicker
						label="Reference asset"
						applyFn={(document, imageId) => ({
							...document,
							reference: {
								imageId,
								opacity: 0.65,
								visible: true,
							},
						})}
					/>
					{painting.reference !== null ? (
						<>
							<img
								className="max-h-44 w-full object-contain"
								src={
									painting.images.find(
										(image) => image.id === painting.reference?.imageId,
									)?.png
								}
							/>
							<EditorNumberControl
								label="Reference opacity (%)"
								min={0}
								max={100}
								value={Math.round(painting.reference.opacity * 100)}
								onChangeFn={(value) => {
									if (Number.isFinite(value) && painting.reference !== null)
										session.editFn({
											...painting,
											reference: {
												...painting.reference,
												opacity: Math.max(0, Math.min(100, value)) / 100,
											},
										});
								}}
							/>
							<div className="flex gap-2">
								<Tooltip
									content={
										painting.reference.visible
											? "Hide reference"
											: "Show reference"
									}
									contentClassName="z-50"
								>
									<LinkButton
										className="inline-flex size-9 items-center justify-center no-underline hover:no-underline"
										onClick={() => {
											if (painting.reference !== null)
												session.editFn({
													...painting,
													reference: {
														...painting.reference,
														visible: !painting.reference.visible,
													},
												});
										}}
									>
										{painting.reference.visible ? (
											<Eye className="size-4" />
										) : (
											<EyeOff className="size-4" />
										)}
									</LinkButton>
								</Tooltip>
								<Tooltip
									content="Remove reference"
									contentClassName="z-50"
								>
									<LinkButton
										className="inline-flex size-9 items-center justify-center no-underline hover:no-underline"
										onClick={() =>
											session.editFn({
												...painting,
												reference: null,
											})
										}
									>
										<X className="size-4" />
									</LinkButton>
								</Tooltip>
							</div>
						</>
					) : null}
				</div>
			</EditorRootCard>
			<EditorRootCard>
				<h2 className="font-semibold">Add texture layer</h2>
				{painting.layers.length < 16 ? (
					<TilePaintingImagePicker
						label="Texture asset"
						applyFn={(document, imageId) => {
							const id = createId();
							session.setActiveLayerIdFn(id);
							return {
								...document,
								layers: [
									...document.layers,
									{
										id,
										name:
											document.images.find((image) => image.id === imageId)
												?.label ?? "Texture",
										imageId,
										visible: true,
										opacity: 1,
										tileSize: 256,
										shadow: TilePaintingDefaultShadow,
										strokes: [],
									},
								],
							};
						}}
					/>
				) : (
					<p className="text-sm text-muted">
						The painting has reached its 16-layer limit.
					</p>
				)}
			</EditorRootCard>
			{[
				...painting.layers,
			]
				.reverse()
				.map((layer) => {
					const index = painting.layers.indexOf(layer);
					const changeFn = (patch: Partial<typeof layer>) =>
						session.editFn({
							...painting,
							layers: painting.layers.map((candidate) =>
								candidate.id === layer.id
									? {
											...layer,
											...patch,
										}
									: candidate,
							),
						});
					const moveFn = (offset: number) => {
						const layers = [
							...painting.layers,
						];
						const target = index + offset;
						if (target < 0 || target >= layers.length) return;
						[layers[index], layers[target]] = [
							layers[target],
							layers[index],
						];
						session.editFn({
							...painting,
							layers,
						});
					};
					return (
						<div
							key={layer.id}
							className="grid gap-3 rounded-xl border border-line-strong bg-surface-raised p-4 data-[ui-selected=true]:border-accent"
							{...readDataUiFn({
								dataUi: "TilePaintingLayer",
								state: {
									selected: layer.id === session.activeLayerId,
								},
							})}
						>
							<div className="flex items-center gap-3">
								<img
									className="size-14 rounded-lg object-cover"
									src={
										painting.images.find((image) => image.id === layer.imageId)
											?.png
									}
								/>
								<LinkButton
									className="inline-flex items-center justify-center mr-auto min-h-9"
									onClick={() => session.setActiveLayerIdFn(layer.id)}
								>
									{layer.name}
								</LinkButton>
								<LayerShadowControl
									layer={layer}
									onChangeFn={(shadow) =>
										changeFn({
											shadow,
										})
									}
								/>
								<Tooltip
									content={layer.visible ? "Hide layer" : "Show layer"}
									contentClassName="z-50"
								>
									<LinkButton
										className="inline-flex items-center justify-center size-9 shrink-0 no-underline hover:no-underline"
										onClick={() =>
											changeFn({
												visible: !layer.visible,
											})
										}
									>
										{layer.visible ? (
											<Eye className="size-4" />
										) : (
											<EyeOff className="size-4" />
										)}
									</LinkButton>
								</Tooltip>
								<Tooltip
									content="Move up"
									contentClassName="z-50"
								>
									<LinkButton
										className="inline-flex items-center justify-center size-9 shrink-0 no-underline hover:no-underline"
										disabled={index === painting.layers.length - 1}
										onClick={() => moveFn(1)}
									>
										<ArrowUp className="size-4" />
									</LinkButton>
								</Tooltip>
								<Tooltip
									content="Move down"
									contentClassName="z-50"
								>
									<LinkButton
										className="inline-flex items-center justify-center size-9 shrink-0 no-underline hover:no-underline"
										disabled={index === 0}
										onClick={() => moveFn(-1)}
									>
										<ArrowDown className="size-4" />
									</LinkButton>
								</Tooltip>
								<Tooltip
									content="Remove layer (undo available)"
									contentClassName="z-50"
								>
									<LinkButton
										className="inline-flex items-center justify-center size-9 shrink-0 no-underline hover:no-underline"
										onClick={() =>
											session.editFn({
												...painting,
												layers: painting.layers.filter(
													(candidate) => candidate.id !== layer.id,
												),
											})
										}
									>
										<Trash2 className="size-4" />
									</LinkButton>
								</Tooltip>
							</div>
							<div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.6fr)_minmax(0,1.4fr)]">
								<EditorTextControl
									label="Name"
									value={layer.name}
									onChangeFn={(name) =>
										changeFn({
											name,
										})
									}
								/>
								<EditorNumberControl
									label="Texture width (px)"
									min={8}
									max={2048}
									value={layer.tileSize}
									onChangeFn={(value) => {
										if (Number.isFinite(value))
											changeFn({
												tileSize: Math.max(8, Math.min(2048, value)),
											});
									}}
								/>
								<EditorNumberControl
									label="Opacity (%)"
									min={0}
									max={100}
									value={Math.round(layer.opacity * 100)}
									onChangeFn={(value) => {
										if (Number.isFinite(value))
											changeFn({
												opacity: Math.max(0, Math.min(100, value)) / 100,
											});
									}}
								/>
								<TilePaintingImagePicker
									label="Replace texture · keep mask"
									description="Choose another asset and confirm to replace this layer’s texture. Your painted shape, transparent areas and soft transitions stay intact — for example, turn a grass island into sand without repainting it."
									applyFn={(document, imageId) => ({
										...document,
										layers: document.layers.map((candidate) =>
											candidate.id === layer.id
												? {
														...candidate,
														imageId,
													}
												: candidate,
										),
									})}
								/>
							</div>
						</div>
					);
				})}
		</fieldset>
	);
};

/** Keeps per-layer shadow tuning in a compact dialog without expanding the layer list. */
const LayerShadowControl = ({
	layer,
	onChangeFn,
}: {
	readonly layer: TilePaintingDocumentSchema.Layer;
	readonly onChangeFn: (shadow: TilePaintingDocumentSchema.Shadow) => void;
}) => {
	const session = useTilePaintingSession();
	const [open, setOpenFn] = useState(false);
	const shadow = layer.shadow ?? TilePaintingDefaultShadow;
	return (
		<>
			<Tooltip
				content="Layer shadow — Adjust the shadow cast onto lower terrain layers."
				contentClassName="z-50"
			>
				<LinkButton
					className="inline-flex size-9 shrink-0 items-center justify-center no-underline hover:no-underline"
					onClick={() => setOpenFn(true)}
				>
					<Sun className="size-4" />
				</LinkButton>
			</Tooltip>
			{open ? (
				<TilePaintingDialog
					title={`Shadow · ${layer.name}`}
					onCloseFn={() => setOpenFn(false)}
				>
					<fieldset
						disabled={session.busy}
						className="grid gap-4"
						data-ui="TilePaintingLayerShadow"
					>
						<label className="flex items-center gap-2 text-sm font-semibold">
							<input
								type="checkbox"
								checked={shadow.enabled}
								onChange={(event) =>
									onChangeFn({
										...shadow,
										enabled: event.currentTarget.checked,
									})
								}
							/>
							Cast shadow onto lower layers
						</label>
						<fieldset
							disabled={!shadow.enabled}
							className="grid grid-cols-2 gap-3 disabled:opacity-50"
						>
							<EditorNumberControl
								label="Strength (%)"
								min={0}
								max={100}
								value={Math.round(shadow.opacity * 100)}
								onChangeFn={(value) => {
									if (Number.isFinite(value))
										onChangeFn({
											...shadow,
											opacity: Math.max(0, Math.min(100, value)) / 100,
										});
								}}
							/>
							{(
								[
									{
										key: "blur",
										label: "Blur (px)",
										min: 0,
										max: 128,
									},
									{
										key: "offsetX",
										label: "Horizontal offset (px)",
										min: -256,
										max: 256,
									},
									{
										key: "offsetY",
										label: "Vertical offset (px)",
										min: -256,
										max: 256,
									},
								] as const
							).map(({ key, label, min, max }) => (
								<EditorNumberControl
									key={key}
									label={label}
									min={min}
									max={max}
									value={shadow[key]}
									onChangeFn={(value) => {
										if (Number.isFinite(value))
											onChangeFn({
												...shadow,
												[key]: Math.max(min, Math.min(max, value)),
											});
									}}
								/>
							))}
							<label className="col-span-2 flex items-center justify-between gap-3 text-sm font-semibold">
								Shadow color
								<input
									type="color"
									value={shadow.color}
									className="h-9 w-16 cursor-pointer rounded border border-line bg-transparent p-1"
									onChange={(event) =>
										onChangeFn({
											...shadow,
											color: event.currentTarget.value,
										})
									}
								/>
							</label>
						</fieldset>
						<p className="text-xs text-muted">
							Changes apply immediately and support undo. Transparent areas stay
							clear.
						</p>
					</fieldset>
				</TilePaintingDialog>
			) : null}
		</>
	);
};
