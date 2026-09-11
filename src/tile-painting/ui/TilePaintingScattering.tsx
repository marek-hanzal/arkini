import { useTilePaintingImageUrls } from "~/tile-painting/ui/useTilePaintingImageUrls";
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
	const imageUrls = useTilePaintingImageUrls(session.document.images);
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
			<div className="ak-list grid gap-2">
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
						<article
							key={entry.id}
							data-ui="TilePaintingScatterEntry"
							className="ak-list-row grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 rounded-xl px-4 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,36rem)_auto]"
						>
							<div className="flex min-w-0 items-center gap-3">
								<img
									className="size-12 shrink-0 object-contain"
									src={image === undefined ? undefined : imageUrls.get(image.id)}
								/>
								<span className="min-w-0 flex-1 truncate font-semibold">
									{image?.label}
								</span>
							</div>
							<div className="col-span-2 row-start-2 grid min-w-0 grid-cols-3 gap-3 lg:col-span-1 lg:col-start-2 lg:row-start-1">
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
							<Tooltip
								content="Remove from catalog (existing stamps stay)"
								contentClassName="z-50"
							>
								<LinkButton
									className="col-start-2 row-start-1 inline-flex size-9 shrink-0 items-center justify-center no-underline hover:no-underline lg:col-start-3"
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
						</article>
					);
				})}
			</div>
		</fieldset>
	);
};
