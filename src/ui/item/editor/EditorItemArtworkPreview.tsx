import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { EditorFormCard } from "~/ui/form/EditorFormCard";
import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";
import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";

const formatProgress = (progress: number) =>
	`${Number.isInteger(progress) ? progress : progress.toFixed(1)}%`;

/** Mirrors the engine's evenly distributed progress-artwork projection. */
export const EditorItemArtworkPreview = ({ asset }: { readonly asset: EditorItem["asset"] }) => {
	const sources = asset.sources ?? [];
	return (
		<EditorFormCard>
			<header className="flex items-center gap-1">
				<h2 className="text-base font-semibold">Artwork progression</h2>
				<EditorInfoTooltip content="The default composition starts at 0%. Progress assets replace the complete composition at the evenly distributed thresholds shown below, matching the runtime engine." />
			</header>
			<div className="flex items-center gap-4">
				<EditorItemThumbnail
					className="size-24"
					resourceIds={asset.default}
				/>
				<div className="grid gap-1">
					<h3 className="text-sm font-semibold">Default composition</h3>
					<p className="font-mono text-xs text-muted">{asset.default.join(" + ")}</p>
					<p className="text-xs text-muted">Shown from 0% progress.</p>
				</div>
			</div>
			{sources.length === 0 ? (
				<p className="text-sm text-muted">No progress artwork configured.</p>
			) : (
				<div className="min-w-0 overflow-x-auto pb-1">
					<ol
						className="grid min-w-max"
						style={{
							gridTemplateColumns: `repeat(${sources.length + 1}, minmax(9rem, 1fr))`,
						}}
					>
						<li className="relative grid justify-items-center gap-2 px-3 text-center">
							<span className="text-xs font-semibold tabular-nums text-muted">
								0%
							</span>
							<span className="relative z-10 size-3 rounded-full bg-secondary" />
							<EditorItemThumbnail
								resourceIds={asset.default}
								size="md"
							/>
							<span className="max-w-32 truncate text-xs font-medium">Default</span>
						</li>
						{sources.map((resourceId, index) => {
							const threshold = ((index + 1) / sources.length) * 100;
							return (
								<li
									key={`${resourceId}-${index}`}
									className="relative grid justify-items-center gap-2 px-3 text-center before:absolute before:top-[1.7rem] before:right-1/2 before:h-px before:w-full before:bg-line-strong"
								>
									<span className="text-xs font-semibold tabular-nums text-muted">
										{formatProgress(threshold)}
									</span>
									<span className="relative z-10 size-3 rounded-full bg-secondary" />
									<EditorItemThumbnail
										resourceIds={[
											resourceId,
										]}
										size="md"
									/>
									<span
										className="max-w-32 truncate font-mono text-xs"
										title={resourceId}
									>
										{resourceId}
									</span>
								</li>
							);
						})}
					</ol>
				</div>
			)}
		</EditorFormCard>
	);
};
