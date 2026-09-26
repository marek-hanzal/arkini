import { ItemDetailDefault } from "~/item-detail/ui/ItemDetailDefault";
import { ItemDetailSimple } from "~/item-detail/ui/ItemDetailSimple";
import { useItemDetailSceneController } from "~/item-detail/ui/useItemDetailSceneController";
import { Tx } from "~/translation/ui/Tx";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { useLayoutEffect, useRef } from "react";

interface ItemDetailSceneProps extends useItemDetailSceneController.Props {
	readonly disabled: boolean;
}

/** Composes the shared item frame and its player-facing sections. */
export const ItemDetailScene = ({ disabled, target }: ItemDetailSceneProps) => {
	const controller = useItemDetailSceneController({
		target,
	});
	const panelRef = useRef<HTMLDivElement>(null);
	const targetKey = target.kind === "runtime" ? target.itemId : target.itemUid;
	useLayoutEffect(() => {
		if (controller.detail?.ui !== "default") return;
		const panel = panelRef.current;
		const lines = panel?.querySelector<HTMLElement>('[data-ui="ItemLines"]');
		if (panel === null || lines === null || lines === undefined) return;
		panel.scrollTop += lines.getBoundingClientRect().top - panel.getBoundingClientRect().top;
	}, [
		targetKey,
		controller.detail?.ui,
	]);
	return (
		<div
			className="flex min-h-0 flex-1 flex-col"
			data-ui="ItemDetailScene"
		>
			<div
				ref={panelRef}
				className="min-h-0 flex-1 overflow-auto [container-type:size] transition-opacity duration-300 data-[ui-stale=true]:opacity-45"
				{...readDataUiFn({
					dataUi: "ItemDetailPanel",
					state: {
						interface: controller.detail?.ui,
						stale: controller.stale,
					},
				})}
			>
				{controller.detail?.ui === "default" ? (
					<ItemDetailDefault
						detail={controller.detail}
						disabled={disabled}
						stale={controller.stale}
						target={target}
					/>
				) : controller.detail?.ui === "simple" ? (
					<ItemDetailSimple
						detail={controller.detail}
						disabled={disabled}
						ownerItemId={target.kind === "runtime" ? target.itemId : undefined}
						stale={controller.stale}
					/>
				) : (
					<h2 className="p-6 text-2xl font-semibold">
						<Tx label="Item unavailable" />
					</h2>
				)}
			</div>
		</div>
	);
};
