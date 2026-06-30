import type { FC } from "react";
import type { ViewItemGeneratedEffect } from "~/v0/item/view/ViewItemSchema";
import { UiSection } from "~/v0/ui/UiSection";
import {
	effectPolaritySections,
	readEffectPolarityBadgeClassName,
	readEffectPolarityLabel,
} from "~/v0/item/ui/effectPolarityUi";

export namespace ItemGeneratedEffectsCard {
	export interface Props {
		effects: readonly ViewItemGeneratedEffect[];
	}
}

const readSourceScopeLabel = (effect: ViewItemGeneratedEffect) => {
	if (effect.sourceScope === "both") return "Active from board or inventory";
	if (effect.sourceScope === "inventory") return "Active while stored in inventory";
	return "Active while placed on board";
};

export const ItemGeneratedEffectsCard: FC<ItemGeneratedEffectsCard.Props> = ({ effects }) => {
	if (effects.length === 0) return null;

	const effectGroups = effectPolaritySections
		.map((section) => ({
			...section,
			effects: effects.filter((effect) => effect.polarity === section.polarity),
		}))
		.filter((group) => group.effects.length > 0);

	return (
		<>
			{effectGroups.map((group) => (
				<UiSection
					key={group.polarity}
					eyebrow="Effects"
					title={group.title}
				>
					<div className="grid gap-2">
						{group.effects.map((effect) => (
							<div
								key={effect.id}
								data-ui="generated effect"
								className="min-w-0 rounded-sm bg-ak-surface px-3 py-2.5"
							>
								<div className="flex min-w-0 items-start justify-between gap-3">
									<p className="min-w-0 break-words font-semibold text-ak-text">
										{effect.name}
									</p>
									<div className="flex shrink-0 flex-wrap justify-end gap-1">
										<span
											className={`rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] ${readEffectPolarityBadgeClassName(
												effect.polarity,
											)}`}
										>
											{readEffectPolarityLabel(effect.polarity)}
										</span>
										<span className="rounded-full border border-ak-border px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ak-text-muted">
											Global grant
										</span>
									</div>
								</div>
								<p className="mt-1 break-words text-xs leading-5 text-ak-text-muted">
									{readSourceScopeLabel(effect)}
								</p>
								<ul className="mt-2 grid gap-1.5">
									{effect.grants.map((grant, index) => (
										<li
											key={`${effect.id}:${grant.id}:${index}`}
											className="break-words text-xs leading-5 text-ak-text-muted"
										>
											<span className="font-semibold text-ak-text">
												{grant.id}
											</span>
											: {grant.summary}
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</UiSection>
			))}
		</>
	);
};
