import { type FC, useState } from "react";
import type { ViewItemGeneratedEffect } from "~/v0/item/view/ViewItemSchema";
import { cn } from "~/v0/ui/cn";
import { DetailCard, DetailMutedPill, DetailTabs } from "~/v1/item-detail/ui/DetailCard";
import {
	effectDetailPolarityTabs,
	readEffectDetailPolarityClassName,
	readEffectDetailPolarityLabel,
} from "~/v1/item-detail/ui/effectDetailPresentation";

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
	const [selectedPolarity, setSelectedPolarity] = useState(groups[0]?.polarity ?? "neutral");
	const activeGroup = groups.find((group) => group.polarity === selectedPolarity) ?? groups[0];

	if (!activeGroup) return null;

	return (
		<DetailCard
			eyebrow="Effects"
			title="Provided effects"
			action={<DetailMutedPill>{effects.length}</DetailMutedPill>}
		>
			{groups.length > 1 ? (
				<DetailTabs
					items={groups.map((group) => ({
						count: group.effects.length,
						id: group.polarity,
						label: group.label,
					}))}
					selectedId={activeGroup.polarity}
					onSelect={(polarity) =>
						setSelectedPolarity(polarity as typeof selectedPolarity)
					}
				/>
			) : null}
			<div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
				{activeGroup.effects.map((effect) => (
					<article
						key={effect.id}
						data-ui="generated effect"
						className="rounded-sm border border-ak-border/80 bg-ak-surface px-3 py-2.5"
					>
						<div className="flex min-w-0 items-start justify-between gap-2">
							<div className="min-w-0">
								<p className="break-words text-sm font-black text-ak-text">
									{effect.name}
								</p>
								<p className="mt-1 text-xs font-semibold text-ak-text-muted">
									{readSourceScopeLabel(effect)}
								</p>
							</div>
							<span
								className={cn(
									"shrink-0 rounded-full border px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.14em]",
									readEffectDetailPolarityClassName(effect.polarity),
								)}
							>
								{readEffectDetailPolarityLabel(effect.polarity)}
							</span>
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
	);
};
