import type { useItemDetailSceneController } from "~/item-detail/ui/useItemDetailSceneController";
import { useTranslator } from "~/translation/ui/useTranslator";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { ItemArtwork } from "~/ui/ui/ItemArtwork";

interface ItemInfoProps {
	readonly detail: useItemDetailSceneController.Detail;
	readonly stale: boolean;
}

const ItemInfoProgress = ({
	dataUi,
	fraction,
	value,
}: {
	readonly dataUi: "ItemUnitsProgress" | "ItemLifetimeProgress";
	readonly fraction: number;
	readonly value: string;
}) => {
	const filledPercent = Math.max(0, Math.min(1, fraction)) * 100;
	return (
		<div
			className="relative h-10 w-full overflow-hidden rounded-full border border-line bg-surface-raised/60 shadow-inner"
			data-ui={dataUi}
		>
			<div
				className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-300 ease-out"
				data-ui={`${dataUi}Fill`}
				style={{
					width: `${filledPercent}%`,
				}}
			/>
			<span className="absolute inset-0 grid place-items-center text-sm font-semibold tabular-nums text-foreground">
				{value}
			</span>
			<span
				className="absolute inset-0 grid place-items-center text-sm font-semibold tabular-nums text-accent-contrast transition-[clip-path] duration-300 ease-out"
				style={{
					clipPath: `inset(0 ${100 - filledPercent}% 0 0)`,
				}}
			>
				{value}
			</span>
		</div>
	);
};

/** The player's basic item facts, without authoring controls or resource identifiers. */
export const ItemInfo = ({ detail, stale }: ItemInfoProps) => {
	const translator = useTranslator();
	const colorFraction =
		detail.units === undefined
			? 1
			: Math.max(0, Math.min(1, detail.units.remaining / detail.units.total));
	return (
		<section
			className="flex items-center justify-center p-6"
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
						colorFraction={colorFraction}
					/>
				</div>
				<div className="grid min-w-0 gap-8">
					<h2 className="text-3xl font-semibold leading-tight">
						{detail.title}
						{stale ? ` · ${translator.textFn("Gone")}` : null}
					</h2>
					{detail.description ? (
						<p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
							{detail.description}
						</p>
					) : null}

					{detail.units !== undefined || detail.lifetime !== undefined ? (
						<div className="grid gap-3">
							{detail.units === undefined ? null : (
								<ItemInfoProgress
									dataUi="ItemUnitsProgress"
									fraction={colorFraction}
									value={`${detail.units.remaining}/${detail.units.total}`}
								/>
							)}
							{detail.lifetime === undefined ? null : (
								<ItemInfoProgress
									dataUi="ItemLifetimeProgress"
									fraction={detail.lifetime.remainingMs / detail.lifetime.totalMs}
									value={formatDurationFn(
										detail.lifetime.remainingMs,
										"countdown",
									)}
								/>
							)}
						</div>
					) : null}
				</div>
			</div>
		</section>
	);
};
