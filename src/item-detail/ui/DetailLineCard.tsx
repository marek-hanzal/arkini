import type { FC } from "react";
import type { ItemCatalogView } from "~/item/view/ItemCatalogViewSchema";
import type { DetailLineModel } from "~/item-detail/control/DetailLineModel";
import { DetailMutedPill } from "~/item-detail/ui/DetailCard";
import { DetailLineActions } from "~/item-detail/ui/DetailLineActions";
import { DetailLineInputs } from "~/item-detail/ui/DetailLineInputs";
import { DetailLineNoteList } from "~/item-detail/ui/DetailLineNoteList";
import { DetailLineOutputs } from "~/item-detail/ui/DetailLineOutputs";
import { DetailTargetLimits } from "~/item-detail/ui/DetailTargetLimits";
import {
	readEffectDetailPolarityClassName,
	readEffectDetailPolarityLabel,
} from "~/item-detail/ui/effectDetailPresentation";
import { readDetailLineEffectPolarity } from "~/item-detail/ui/readDetailLineEffectPolarity";
import { readDetailLineEffectRequirementSummary } from "~/item-detail/ui/readDetailLineEffectRequirementSummary";

export const DetailLineCard: FC<{
	items: ItemCatalogView;
	model: DetailLineModel;
}> = ({ items, model }) => {
	const { control, line } = model;
	const effectPolarity = readDetailLineEffectPolarity(line);
	const targetLimits = line.targetLimits ?? [];
	const effectBenefits = line.effectBenefits ?? [];
	const effectBonusLines = line.effectBonusLines ?? [];
	const effectRequirements = readDetailLineEffectRequirementSummary(line);
	const showInputs = !line.inProgress;

	return (
		<article className="min-w-0">
			<header className="flex min-w-0 items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 flex-wrap items-center gap-1.5">
						<p className="mr-auto break-words text-base font-black leading-6 text-ak-text">
							{line.name}
						</p>
						{line.isDefault ? <DetailMutedPill>Default</DetailMutedPill> : null}
						{effectPolarity ? (
							<DetailMutedPill
								className={readEffectDetailPolarityClassName(effectPolarity)}
							>
								{readEffectDetailPolarityLabel(effectPolarity)}
							</DetailMutedPill>
						) : null}
					</div>
				</div>
			</header>

			<div className="mt-3 grid gap-2">
				<DetailLineNoteList
					items={effectBenefits}
					title="Effect grants"
					tone="good"
				/>
				<DetailLineNoteList
					items={effectBonusLines}
					title="Active bonuses"
					tone="good"
				/>
				{effectRequirements.labels.length ? (
					<DetailLineNoteList
						items={effectRequirements.labels}
						title={effectRequirements.title}
						tone="warn"
					/>
				) : null}
				<DetailTargetLimits
					id={line.lineId}
					items={items}
					limits={targetLimits}
				/>
				<DetailLineOutputs
					items={items}
					line={line}
				/>
				{showInputs ? (
					<DetailLineInputs
						items={items}
						model={model}
					/>
				) : null}
			</div>

			<DetailLineActions control={control} />
		</article>
	);
};
