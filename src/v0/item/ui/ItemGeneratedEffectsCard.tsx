import type { FC } from "react";
import type { ViewItemGeneratedEffect } from "~/v0/item/view/ViewItemSchema";
import { UiSection } from "~/v0/ui/UiSection";

export namespace ItemGeneratedEffectsCard {
	export interface Props {
		effects: readonly ViewItemGeneratedEffect[];
	}
}

const readScopeLabel = (effect: ViewItemGeneratedEffect) =>
	effect.scope === "global" ? "Global" : `Local radius ${effect.radius ?? "?"}`;

export const ItemGeneratedEffectsCard: FC<ItemGeneratedEffectsCard.Props> = ({ effects }) => {
	if (effects.length === 0) return null;

	return (
		<UiSection
			eyebrow="Effects"
			title="Generated effects"
		>
			<div className="grid gap-2">
				{effects.map((effect) => (
					<div
						key={effect.id}
						data-ui="generated effect"
						className="min-w-0 rounded-sm bg-ak-surface px-3 py-2.5"
					>
						<div className="flex min-w-0 items-start justify-between gap-3">
							<p className="min-w-0 break-words font-semibold text-ak-text">
								{effect.name}
							</p>
							<span className="shrink-0 rounded-full border border-ak-border px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ak-text-muted">
								{readScopeLabel(effect)}
							</span>
						</div>
						<ul className="mt-2 grid gap-1.5">
							{effect.operations.map((operation, index) => (
								<li
									key={`${effect.id}:${operation.kind}:${index}`}
									className="break-words text-xs leading-5 text-ak-text-muted"
								>
									<span className="font-semibold text-ak-text">
										{operation.kind}
									</span>
									: {operation.summary}
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
		</UiSection>
	);
};
