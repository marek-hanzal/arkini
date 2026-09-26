import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { useItemDetailSceneController } from "~/item-detail/ui/useItemDetailSceneController";
import { useTranslator } from "~/translation/ui/useTranslator";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { ItemArtwork } from "~/ui/ui/ItemArtwork";

interface ItemInfoProps {
	readonly detail: useItemDetailSceneController.Detail;
	readonly stale: boolean;
	readonly children?: ReactNode;
	readonly requirements?: ReactNode;
}

const ItemInfoProgress = ({
	dataUi,
	fraction,
	value,
}: {
	readonly dataUi: "ItemLifetimeProgress" | "ItemJobProgress";
	readonly fraction: number;
	readonly value: string;
}) => {
	const filledPercent = Math.max(0, Math.min(1, fraction)) * 100;
	return (
		<div
			className="relative h-10 w-full overflow-hidden rounded-full bg-surface-raised/80 shadow-inner"
			data-ui={dataUi}
		>
			<div
				className="absolute inset-y-0 left-0 rounded-full bg-muted transition-[width] duration-300 ease-out"
				data-ui={`${dataUi}Fill`}
				style={{
					width: `${filledPercent}%`,
				}}
			/>
			<span className="absolute inset-0 grid place-items-center text-sm font-semibold tabular-nums text-foreground">
				{value}
			</span>
			<span
				className="absolute inset-0 grid place-items-center text-sm font-semibold tabular-nums text-surface transition-[clip-path] duration-300 ease-out"
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
export const ItemInfo = ({ detail, stale, children, requirements }: ItemInfoProps) => {
	const translator = useTranslator();
	const colorFraction =
		detail.units === undefined
			? 1
			: detail.units.remaining === 0 && detail.activeJob !== undefined
				? 1
				: Math.max(0, Math.min(1, detail.units.remaining / detail.units.total));
	const lifetimeProgress =
		detail.lifetime === undefined ? null : (
			<ItemInfoProgress
				dataUi="ItemLifetimeProgress"
				fraction={detail.lifetime.remainingMs / detail.lifetime.totalMs}
				value={formatDurationFn(detail.lifetime.remainingMs, "countdown")}
			/>
		);
	const jobProgress =
		detail.activeJob === undefined || detail.activeJob.durationMs <= 0 ? null : (
			<ItemInfoProgress
				dataUi="ItemJobProgress"
				fraction={1 - detail.activeJob.remainingMs / detail.activeJob.durationMs}
				value={`${formatDurationFn(detail.activeJob.durationMs - detail.activeJob.remainingMs, "countdown")} / ${formatDurationFn(detail.activeJob.durationMs)}`}
			/>
		);
	const simple = detail.ui === "simple";
	return (
		<section
			className="flex items-center justify-center p-6"
			data-ui="ItemInfo"
		>
			<div className="grid w-full max-w-5xl grid-cols-2 items-center gap-12">
				<div
					className="group relative isolate aspect-square w-full max-w-md justify-self-center"
					data-ui="ItemInfoArtwork"
				>
					<ItemArtwork
						className="size-full translate-y-3"
						sourceUrl={detail.sourceUrl}
						compositeUrl={detail.compositeUrl}
						colorFraction={colorFraction}
					/>
					{simple && !stale ? (
						<AnimatePresence initial={false}>
							{jobProgress !== null ? (
								<motion.div
									key="job"
									className="pointer-events-none absolute inset-x-7 bottom-2 z-30"
									initial={{
										opacity: 0,
									}}
									animate={{
										opacity: 1,
									}}
									exit={{
										opacity: 0,
									}}
									transition={{
										duration: 0.2,
									}}
								>
									{jobProgress}
								</motion.div>
							) : requirements !== undefined ? (
								<motion.div
									key="requirements"
									className="absolute inset-x-4 bottom-2 z-30 rounded-2xl bg-overlay-foreground/15 px-4 py-2.5 text-foreground"
									initial={{
										opacity: 0,
									}}
									animate={{
										opacity: 1,
									}}
									exit={{
										opacity: 0,
									}}
									transition={{
										duration: 0.2,
									}}
									data-ui="ItemInfoRequirements"
								>
									{requirements}
								</motion.div>
							) : lifetimeProgress !== null ? (
								<motion.div
									key="lifetime"
									className="pointer-events-none absolute inset-x-7 bottom-2 z-30"
									initial={{
										opacity: 0,
									}}
									animate={{
										opacity: 1,
									}}
									exit={{
										opacity: 0,
									}}
									transition={{
										duration: 0.2,
									}}
								>
									{lifetimeProgress}
								</motion.div>
							) : null}
						</AnimatePresence>
					) : null}
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

					{!simple && !stale && lifetimeProgress !== null ? (
						<div className="grid gap-3">{lifetimeProgress}</div>
					) : null}
					{children}
				</div>
			</div>
		</section>
	);
};
