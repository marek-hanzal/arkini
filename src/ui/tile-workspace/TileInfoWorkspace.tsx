import type { useTileInfo } from "~/bridge/tile/useTileInfo";

/** Renders the sparse Info capability with a large inspectable authored visual. */
export const TileInfoWorkspace = ({
	info,
}: {
	readonly info: Extract<
		useTileInfo.Projection,
		{
			readonly kind: "available";
		}
	>;
}) => (
	<div
		className="grid min-h-0 flex-1 gap-[var(--ak-panel-padding)]"
		data-ui="TileInfoWorkspace"
	>
		<div
			className="relative grid min-h-0 place-items-center overflow-hidden"
			data-ui="TileInfoArtwork"
		>
			<div className="relative aspect-square size-full max-h-full max-w-full">
				<img
					className="absolute inset-0 size-full object-contain drop-shadow-[0_1.2rem_1.5rem_color-mix(in_srgb,var(--ak-overlay)_42%,transparent)]"
					src={info.sourceUrl}
					alt=""
					draggable={false}
				/>
				{info.compositeUrl === undefined ? null : (
					<img
						className="absolute inset-0 size-full object-contain drop-shadow-[0_1.2rem_1.5rem_color-mix(in_srgb,var(--ak-overlay)_42%,transparent)]"
						src={info.compositeUrl}
						alt=""
						draggable={false}
					/>
				)}
			</div>
		</div>
		<p className="min-h-0 min-w-0 overflow-y-auto pr-1 text-pretty text-base leading-relaxed text-muted">
			{info.description}
		</p>
	</div>
);
