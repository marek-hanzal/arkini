import { ListX } from "lucide-react";
import { useItemInfoQueueController } from "~/item-detail/ui/useItemInfoQueueController";
import { LinkButton } from "~/ui/ui/LinkButton";
import type { useItemDetailSceneController } from "~/item-detail/ui/useItemDetailSceneController";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Fact, FactList } from "~/ui/ui/FactList";
import { ItemArtwork } from "~/ui/ui/ItemArtwork";

interface ItemInfoProps extends useItemInfoQueueController.Props {
	readonly detail: useItemDetailSceneController.Detail;
}

/** The player's basic item facts, without authoring controls or resource identifiers. */
export const ItemInfo = ({ detail, ownerItemId, disabled }: ItemInfoProps) => {
	const translator = useTranslator();
	const queue = useItemInfoQueueController({
		ownerItemId,
		disabled,
	});
	const depleted =
		detail.units === undefined
			? 0
			: Math.max(0, Math.min(1, 1 - detail.units.remaining / detail.units.total));
	return (
		<section
			className="flex min-h-full items-center justify-center p-6"
			data-ui="ItemInfo"
		>
			<div className="grid w-full max-w-5xl grid-cols-2 items-center gap-12">
				<div
					className="relative isolate aspect-square w-full max-w-md justify-self-center"
					data-ui="ItemInfoArtwork"
				>
					<ItemArtwork
						className="size-full"
						sourceUrl={detail.sourceUrl}
						compositeUrl={detail.compositeUrl}
						colorFraction={1 - depleted}
					/>
				</div>
				<div className="grid min-w-0 gap-8">
					{detail.description ? (
						<p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
							{detail.description}
						</p>
					) : null}
					<div className="grid grid-cols-2 items-start gap-8">
						<FactList columns={1}>
							<Fact
								label={translator.textFn("Where you can keep it")}
								value={
									detail.scope === "any"
										? translator.textFn("Board, inventory and toolbar")
										: translator.textFn(`Item storage scope - ${detail.scope}`)
								}
							/>
							<Fact
								label={translator.textFn("Items per stack")}
								value={
									detail.maxStackSize === 1
										? translator.textFn("Single item")
										: detail.maxStackSize
								}
							/>
							<Fact
								label={translator.textFn("Maximum in the game")}
								value={
									detail.maxCount === undefined
										? translator.textFn("Unlimited")
										: detail.maxCount
								}
							/>
							<Fact
								label={translator.textFn("Units remaining")}
								value={
									detail.units === undefined
										? translator.textFn("This item doesn't use units.")
										: detail.units.remaining === 0
											? translator.textFn("Depleted")
											: `${detail.units.remaining}/${detail.units.total}`
								}
							/>
						</FactList>
						<div
							className="grid gap-4"
							data-ui="ItemInfoQueue"
						>
							{detail.queueSize === undefined ? (
								<p className="text-sm text-muted">
									{translator.textFn("This item has nothing to make.")}
								</p>
							) : (
								<>
									<FactList columns={1}>
										<Fact
											label={translator.textFn("Queue size")}
											value={detail.queueSize}
										/>
										{queue.queued > 0 ? (
											<Fact
												label={translator.textFn("Queued items")}
												value={queue.queued}
											/>
										) : null}
									</FactList>
									{queue.queued > 0 ? (
										<LinkButton
											className="inline-flex items-center gap-2 justify-self-start text-sm"
											disabled={queue.disabled}
											onClick={queue.clearFn}
										>
											<ListX className="size-4" />
											{translator.textFn("Clear queue")}
										</LinkButton>
									) : null}
								</>
							)}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};
