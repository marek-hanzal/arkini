import { type FC } from "react";
import type { ViewItemGeneratedEffect } from "~/item/view/ViewItemSchema";
import { DetailCard, DetailMutedPill, DetailSeparator } from "~/item-detail/ui/DetailCard";
import { effectDetailPolarityTabs } from "~/item-detail/ui/effectDetailPresentation";

export namespace DetailGeneratedEffectsPanel {
	export interface Props {
		effects: readonly ViewItemGeneratedEffect[];
	}
}

const readSourceScopeLabel = (effect: ViewItemGeneratedEffect) => {
	if (effect.sourceScope === "both") return "Board or inventory";
	if (effect.sourceScope === "inventory") return "Inventory only";
	return "Board only";
};

export const DetailGeneratedEffectsPanel: FC<DetailGeneratedEffectsPanel.Props> = ({ effects }) => {
	const groups = effectDetailPolarityTabs
		.map((tab) => ({
			...tab,
			effects: effects.filter((effect) => effect.polarity === tab.polarity),
		}))
		.filter((group) => group.effects.length > 0);

	if (groups.length === 0) return null;

	return (
		<div className="min-w-0">
			{groups.map((group, groupIndex) => (
				<div key={group.polarity}>
					{groupIndex > 0 ? <DetailSeparator className="my-4" /> : null}
					<DetailCard
						eyebrow={groupIndex === 0 ? "Effects" : undefined}
						title={groupIndex === 0 ? undefined : group.title}
					>
						<div className="space-y-2">
							{groupIndex === 0 ? (
								<h3 className="break-words text-base font-black leading-5 text-ak-text">
									{group.title}
								</h3>
							) : null}
							{group.effects.map((effect) => (
								<article
									key={effect.id}
									data-ui="generated effect"
									className="rounded-sm bg-ak-surface/80 px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]"
								>
									<div className="min-w-0">
										<p className="break-words text-sm font-black text-ak-text">
											{effect.name}
										</p>
										<p className="mt-1 text-xs font-semibold text-ak-text-muted">
											{readSourceScopeLabel(effect)}
										</p>
									</div>
									{effect.grants.length ? (
										<div className="mt-2 flex flex-wrap gap-1.5">
											{effect.grants.map((grant) => (
												<DetailMutedPill key={`${effect.id}:${grant.id}`}>
													{grant.name}
												</DetailMutedPill>
											))}
										</div>
									) : null}
								</article>
							))}
						</div>
					</DetailCard>
				</div>
			))}
		</div>
	);
};
