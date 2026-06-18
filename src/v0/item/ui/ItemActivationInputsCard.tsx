import type { FC } from "react";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import type { ItemId } from "~/v0/manifest/manifestId";

export namespace ItemActivationInputsCard {
	export interface Props {
		activation: ActivationView;
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
	const title = activation.kind === "stash" ? "Stash inputs" : "Producer inputs";
	const storedRequirements = activation.requirements.filter(
		(requirement) => requirement.type === "stored",
	);
	const passiveRequirements = activation.requirements.filter(
		(requirement) => requirement.type === "passive",
	);

	return (
		<div className="rounded-md border border-amber-400/20 bg-amber-950/18 p-3">
			<p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
				{title}
			</p>
			{storedRequirements.length ? (
				<div className="mt-3 space-y-2">
					<p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-amber-200/80">
						Persistent requirements
					</p>
					{storedRequirements.map((requirement) => (
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
			{passiveRequirements.length ? (
				<div className="mt-3 space-y-2">
					<p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-amber-200/80">
						Passive requirements
					</p>
					{passiveRequirements.map((requirement) => (
						<div
							key={requirement.itemId}
							className="rounded-sm bg-slate-950/45 px-2 py-1.5 text-xs"
						>
							{items[requirement.itemId]?.name ?? requirement.itemId}: requires{" "}
							{requirement.quantity} owned/available, not dragged here
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
							className="rounded-sm bg-slate-950/45 px-2 py-1.5 text-xs"
						>
							{items[input.itemId]?.name ?? input.itemId}: feed {input.quantity} by
							drag
							{input.consume ? ", consumed at start" : ", returned/kept by action"}
						</div>
					))}
				</div>
			) : null}
		</div>
	);
};
