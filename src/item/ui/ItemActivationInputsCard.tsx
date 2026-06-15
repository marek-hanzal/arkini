import type { FC } from "react";
import type { ActivationView } from "~/board/view/ActivationViewSchema";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { ItemCatalogView } from "~/item/view/ItemCatalogViewSchema";
import type { ItemId } from "~/manifest/manifestId";

export namespace ItemActivationInputsCard {
	export interface Props {
		activation: ActivationView;
		boardItem: BoardViewItem;
		items: ItemCatalogView;
		pending: boolean;
		onWithdraw(itemId: ItemId): void;
	}
}

export const ItemActivationInputsCard: FC<ItemActivationInputsCard.Props> = ({
	activation,
	items,
	pending,
	onWithdraw,
}) => {
	const title = activation.kind === "stash" ? "Stash storage" : "Producer storage";

	return (
		<div className="rounded-md border border-amber-400/20 bg-amber-950/18 p-3">
			<p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
				{title}
			</p>
			{activation.requirements.length ? (
				<div className="mt-3 space-y-2">
					<p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-amber-200/80">
						Persistent requirements
					</p>
					{activation.requirements.map((requirement) => (
						<div
							key={requirement.itemId}
							className="flex items-center justify-between gap-3 rounded-sm bg-slate-950/45 px-2 py-1.5 text-xs"
						>
							<span>
								{items[requirement.itemId]?.name ?? requirement.itemId}:{" "}
								{requirement.stored}/{requirement.capacity} stored, requires{" "}
								{requirement.quantity}, not consumed
							</span>
							<button
								type="button"
								disabled={requirement.stored <= 0 || pending}
								onClick={() => onWithdraw(requirement.itemId)}
								className="rounded-sm bg-slate-800 px-2 py-1 font-bold text-slate-200 disabled:opacity-35"
							>
								Withdraw
							</button>
						</div>
					))}
				</div>
			) : null}
			{activation.inputs.length ? (
				<div className="mt-3 space-y-2">
					<p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-amber-200/80">
						Consumable inputs
					</p>
					{activation.inputs.map((input) => (
						<div
							key={input.itemId}
							className="flex items-center justify-between gap-3 rounded-sm bg-slate-950/45 px-2 py-1.5 text-xs"
						>
							<span>
								{items[input.itemId]?.name ?? input.itemId}: {input.stored}/
								{input.capacity} stored, consumes {input.quantity}
							</span>
							<button
								type="button"
								disabled={input.stored <= 0 || pending}
								onClick={() => onWithdraw(input.itemId)}
								className="rounded-sm bg-slate-800 px-2 py-1 font-bold text-slate-200 disabled:opacity-35"
							>
								Withdraw
							</button>
						</div>
					))}
				</div>
			) : null}
		</div>
	);
};
