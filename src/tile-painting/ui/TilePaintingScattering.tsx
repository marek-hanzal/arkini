import { Tooltip } from "~/ui/ui/Tooltip";
import { LinkButton } from "~/ui/ui/LinkButton";
import { createId } from "@paralleldrive/cuid2";
import { Trash2 } from "lucide-react";
import { useTilePaintingSession } from "~/tile-painting/ui/useTilePaintingSession";
import { TilePaintingImagePicker } from "~/tile-painting/ui/TilePaintingImagePicker";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { EditorNumberControl } from "~/editor-control/ui/EditorValueControls";

export const TilePaintingScattering = () => {
	const session = useTilePaintingSession();
	const painting = session.document;
	return (
		<fieldset
			disabled={session.busy}
			className="grid content-start gap-4 p-4"
			data-ui="TilePaintingScattering"
		>
			<EditorRootCard>
				<h2 className="font-semibold">Scatter catalog</h2>
				<p className="text-sm text-muted">
					Prepare image sizes here. Choose the active brush palette in Tool settings on
					the canvas. Existing strokes keep their exact images, positions and sizes.
				</p>
				<div className="min-w-0 lg:w-2/3">
					<TilePaintingImagePicker
						label="Decoration asset"
						applyFn={(document, imageId) => ({
							...document,
							catalog: [
								...document.catalog,
								{
									id: createId(),
									imageId,
									weight: 1,
									minSize: 32,
									maxSize: 64,
									enabled: true,
								},
							],
						})}
					/>
				</div>
			</EditorRootCard>
			<div className="grid gap-3 lg:grid-cols-2">
				{painting.catalog.map((entry) => {
					const image = painting.images.find((image) => image.id === entry.imageId);
					const changeFn = (minSize: number, maxSize: number) =>
						session.editFn({
							...painting,
							catalog: painting.catalog.map((candidate) =>
								candidate.id === entry.id
									? {
											...candidate,
											minSize,
											maxSize,
										}
									: candidate,
							),
						});
					return (
						<EditorRootCard
							key={entry.id}
							dataUi="TilePaintingScatterEntry"
						>
							<div className="flex items-center gap-4">
								<img
									className="size-16 object-contain"
									src={image?.png}
								/>
								<span className="min-w-0 flex-1 truncate font-semibold">
									{image?.label}
								</span>
								<Tooltip
									content="Remove from catalog (existing stamps stay)"
									contentClassName="z-50"
								>
									<LinkButton
										className="inline-flex size-9 shrink-0 items-center justify-center no-underline hover:no-underline"
										onClick={() =>
											session.editFn({
												...painting,
												catalog: painting.catalog.filter(
													(candidate) => candidate.id !== entry.id,
												),
											})
										}
									>
										<Trash2 className="size-4" />
									</LinkButton>
								</Tooltip>
							</div>
							<div className="grid grid-cols-3 gap-3">
								<EditorNumberControl
									label="Minimum size (px)"
									min={1}
									max={2048}
									value={entry.minSize}
									onChangeFn={(value) => {
										if (Number.isFinite(value)) {
											const size = Math.max(1, Math.min(2048, value));
											changeFn(size, Math.max(size, entry.maxSize));
										}
									}}
								/>
								<EditorNumberControl
									label="Maximum size (px)"
									min={1}
									max={2048}
									value={entry.maxSize}
									onChangeFn={(value) => {
										if (Number.isFinite(value)) {
											const size = Math.max(1, Math.min(2048, value));
											changeFn(Math.min(size, entry.minSize), size);
										}
									}}
								/>
								<EditorNumberControl
									label="Weight (%)"
									min={0}
									max={100000}
									value={Math.round(entry.weight * 100)}
									onChangeFn={(value) => {
										if (Number.isFinite(value))
											session.editFn({
												...painting,
												catalog: painting.catalog.map((candidate) =>
													candidate.id === entry.id
														? {
																...candidate,
																weight:
																	Math.max(
																		0,
																		Math.min(100000, value),
																	) / 100,
															}
														: candidate,
												),
											});
									}}
								/>
							</div>
						</EditorRootCard>
					);
				})}
			</div>
		</fieldset>
	);
};
