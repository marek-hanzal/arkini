import { ItemDetailHeader } from "~/item-detail-frame/ui/ItemDetailHeader";
import { useCloseItemDetail } from "~/item-detail-frame/ui/useCloseItemDetail";
import { ItemDetailContent } from "~/item-detail/ui/ItemDetailContent";
import { ItemDetailTabs } from "~/item-detail/ui/ItemDetailTabs";
import { useRuntimeItemDetailSceneController } from "~/item-detail/ui/useRuntimeItemDetailSceneController";
import { Tx } from "~/translation/ui/Tx";

interface RuntimeItemDetailSceneProps extends useRuntimeItemDetailSceneController.Props {
	readonly disabled: boolean;
}

export const RuntimeItemDetailScene = ({ disabled, target }: RuntimeItemDetailSceneProps) => {
	const controller = useRuntimeItemDetailSceneController({
		target,
	});
	const closeItemDetailFn = useCloseItemDetail();
	return (
		<div
			className="flex min-h-0 flex-1 flex-col"
			data-ui="ItemDetailContentScene"
			data-stale={controller.stale ? "true" : "false"}
		>
			{controller.identity?.kind === "available" ? (
				<ItemDetailHeader
					disabled={disabled}
					identity={controller.identity}
					stale={controller.stale}
				/>
			) : (
				<header className="flex items-center justify-between border-b border-line pb-3">
					<h2 className="text-lg font-semibold">
						<Tx label="Item unavailable" />
					</h2>
					<button
						type="button"
						className="grid size-9 cursor-pointer place-items-center border border-line bg-surface text-lg text-muted"
						onClick={() => closeItemDetailFn()}
					>
						×
					</button>
				</header>
			)}
			<ItemDetailTabs
				active={target.tab}
				disabled={disabled}
				lineCount={controller.stale ? undefined : controller.lineCount}
				queueCount={controller.stale ? undefined : controller.queueCount}
				stale={controller.stale}
				tabs={controller.tabs}
				target={target}
			/>
			<div
				className="flex min-h-0 flex-1 overflow-hidden pt-4"
				data-stale={controller.stale ? "true" : "false"}
			>
				<ItemDetailContent
					kind="runtime"
					disabled={disabled}
					identity={controller.identity}
					info={controller.info}
					linesSearchQuery={target.linesSearchQuery}
					lines={controller.lines}
					queue={controller.queue}
					queueStale={controller.queueStale}
					sources={controller.sources}
					stale={controller.stale}
					target={target}
				/>
			</div>
		</div>
	);
};
