import type { FC } from "react";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { UiSection } from "~/v0/ui/UiSection";

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
	const storedRequirements = activation.requirements.filter(
		(requirement) => requirement.type === "stored",
	);
	const passiveRequirements = activation.requirements.filter(
		(requirement) => requirement.type === "passive",
	);

	return (
		<UiSection
			eyebrow="Inputs"
			title={activation.kind === "stash" ? "Stash rules" : "Producer rules"}
		>
			<div className="grid gap-3">
				{storedRequirements.length ? (
					<div className="grid gap-2">
						<p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-ak-primary">
							Persistent requirements
						</p>
						{storedRequirements.map((requirement) => (
							<div
								key={requirement.itemId}
								className="rounded-sm bg-ak-surface px-2.5 py-2 text-sm text-ak-text-muted"
							>
								<span className="font-semibold text-ak-text">
									{items[requirement.itemId]?.name ?? requirement.itemId}
								</span>{" "}
								· {requirement.stored}/{requirement.capacity} stored · needs{" "}
								{requirement.quantity}
							</div>
						))}
					</div>
				) : null}
				{passiveRequirements.length ? (
					<div className="grid gap-2">
						<p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-ak-primary">
							Passive requirements
						</p>
						{passiveRequirements.map((requirement) => (
							<div
								key={requirement.itemId}
								className="rounded-sm bg-ak-surface px-2.5 py-2 text-sm text-ak-text-muted"
							>
								<span className="font-semibold text-ak-text">
									{items[requirement.itemId]?.name ?? requirement.itemId}
								</span>{" "}
								· needs {requirement.quantity} available in your economy
							</div>
						))}
					</div>
				) : null}
				{activation.inputs.length ? (
					<div className="grid gap-2">
						<p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-ak-primary">
							Consumable inputs
						</p>
						{activation.inputs.map((input) => (
							<div
								key={input.itemId}
								className="rounded-sm bg-ak-surface px-2.5 py-2 text-sm text-ak-text-muted"
							>
								<span className="font-semibold text-ak-text">
									{items[input.itemId]?.name ?? input.itemId}
								</span>{" "}
								· feed {input.quantity} by drag
								{input.consume
									? ", consumed at start"
									: ", returned or kept by action"}
							</div>
						))}
					</div>
				) : null}
			</div>
		</UiSection>
	);
};
