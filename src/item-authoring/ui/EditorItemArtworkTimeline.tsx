import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { EditorItemThumbnail } from "~/ui/item/EditorItemThumbnail";
import { EditorAssetDetailLink } from "~/asset-authoring/ui/EditorAssetDetailLink";

const formatProgress = (progress: number) =>
	`${Number.isInteger(progress) ? progress : progress.toFixed(1)}%`;

interface EditorItemArtworkTimelineProps {
	readonly asset: ItemSchema.Type["asset"];
	readonly linkAssets?: boolean;
	readonly onSelectProgress?: (index: number) => void;
	readonly selectedProgressIndex?: number;
}

const ResourceLabel = ({
	linkAssets,
	resourceId,
}: {
	readonly linkAssets: boolean;
	readonly resourceId: string;
}) =>
	linkAssets ? (
		<EditorAssetDetailLink
			className="max-w-32 truncate font-mono text-xs"
			resourceId={resourceId}
		>
			{resourceId}
		</EditorAssetDetailLink>
	) : (
		<span
			className="max-w-32 truncate font-mono text-xs"
			title={resourceId}
		>
			{resourceId}
		</span>
	);

/** Shows the runtime artwork thresholds shared by read-only and editable item views. */
export const EditorItemArtworkTimeline = ({
	asset,
	linkAssets = false,
	onSelectProgress,
	selectedProgressIndex,
}: EditorItemArtworkTimelineProps) => {
	const sources = asset.sources ?? [];
	return (
		<>
			<div className="flex items-center gap-4">
				<EditorItemThumbnail
					className="size-24"
					resourceIds={asset.default}
				/>
				<div className="grid gap-1">
					<h3 className="text-sm font-semibold">Default composition</h3>
					<div className="flex flex-wrap items-center gap-x-1 font-mono text-xs text-muted">
						{asset.default.map((resourceId, index) => (
							<span
								className="contents"
								key={resourceId}
							>
								{index > 0 ? <span>+</span> : null}
								<ResourceLabel
									linkAssets={linkAssets}
									resourceId={resourceId}
								/>
							</span>
						))}
					</div>
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
							<span className="relative z-10 size-3 rounded-full bg-secondary-selected" />
							<EditorItemThumbnail
								resourceIds={asset.default}
								size="md"
							/>
							<span className="max-w-32 truncate text-xs font-medium">Default</span>
						</li>
						{sources.map((resourceId, index) => {
							const threshold = ((index + 1) / sources.length) * 100;
							const thumbnail = (
								<EditorItemThumbnail
									resourceIds={[
										resourceId,
									]}
									size="md"
								/>
							);
							return (
								<li
									key={`${resourceId}-${index}`}
									className="relative grid justify-items-center gap-2 px-3 text-center before:absolute before:top-[1.7rem] before:right-1/2 before:h-px before:w-full before:bg-line-strong"
								>
									<span className="text-xs font-semibold tabular-nums text-muted">
										{formatProgress(threshold)}
									</span>
									<span className="relative z-10 size-3 rounded-full bg-secondary-selected" />
									{onSelectProgress !== undefined ? (
										<button
											type="button"
											title={`Select progress asset ${index + 1}`}
											className={`cursor-pointer rounded-lg border p-1 ${
												selectedProgressIndex === index
													? "border-accent bg-accent/10"
													: "border-line bg-canvas"
											}`}
											onClick={() => onSelectProgress(index)}
										>
											{thumbnail}
										</button>
									) : linkAssets ? (
										<EditorAssetDetailLink
											className="rounded-lg border border-line bg-canvas p-1"
											resourceId={resourceId}
										>
											{thumbnail}
										</EditorAssetDetailLink>
									) : (
										thumbnail
									)}
									<ResourceLabel
										linkAssets={linkAssets}
										resourceId={resourceId}
									/>
								</li>
							);
						})}
					</ol>
				</div>
			)}
		</>
	);
};
