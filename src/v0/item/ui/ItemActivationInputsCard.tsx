import type { FC } from "react";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
export namespace ItemActivationInputsCard {
	export interface Props {
		activation: ActivationView;
		items: ItemCatalogView;
	}
}

export const ItemActivationInputsCard: FC<ItemActivationInputsCard.Props> = ({
	activation,
	items,
}) => {
	const title = activation.kind === "stash" ? "Stash inputs" : "Producer inputs";
	const storedRequirements = activation.requirements.filter(
		(requirement) => requirement.type === "stored",
	);
	const passiveRequirements = activation.requirements.filter(
		(requirement) => requirement.type === "passive",
	);

	return (
		<div className="ak-ui-card-soft p-3">
			<p className="ak-ui-eyebrow">{title}</p>
			{storedRequirements.length ? (
				<div className="mt-3 grid gap-2">
					<p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-violet-700/80">
						Persistent requirements
					</p>
					{storedRequirements.map((requirement) => (
						<div
							key={requirement.itemId}
							className="ak-ui-row break-words px-2 py-2 text-xs"
						>
							{items[requirement.itemId]?.name ?? requirement.itemId}:{" "}
							{requirement.stored}/{requirement.capacity} stored, requires{" "}
							{requirement.quantity}. Drag matching items onto this tile.
						</div>
					))}
				</div>
			) : null}
			{passiveRequirements.length ? (
				<div className="mt-3 grid gap-2">
					<p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-violet-700/80">
						Passive requirements
					</p>
					{passiveRequirements.map((requirement) => (
						<div
							key={requirement.itemId}
							className="ak-ui-row break-words px-2 py-2 text-xs"
						>
							{items[requirement.itemId]?.name ?? requirement.itemId}: requires{" "}
							{requirement.quantity} owned/available, not dragged here
						</div>
					))}
				</div>
			) : null}
			{activation.inputs.length ? (
				<div className="mt-3 grid gap-2">
					<p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-violet-700/80">
						Consumable inputs
					</p>
					{activation.inputs.map((input) => (
						<div
							key={input.itemId}
							className="ak-ui-row break-words px-2 py-2 text-xs"
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
