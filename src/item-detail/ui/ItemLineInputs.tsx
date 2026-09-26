import { match, P } from "ts-pattern";
import { X } from "lucide-react";
import { useItemLineInputController } from "~/item-detail/ui/useItemLineInputController";
import { Equal, Exit } from "effect";
import { useCallback } from "react";

import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { readItemLineInputsFx } from "~/item-detail-read/fx/readItemLineInputsFx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { ItemArtwork } from "~/ui/ui/ItemArtwork";
import { Tooltip } from "~/ui/ui/Tooltip";
import { BoardDistancePresentation } from "~/item-query/ui/QueryPresentation";

/** Shared input thumbnails; unit payers stay in place while material slots support delivery and withdrawal. */
export const ItemLineInputs = ({
	ownerItemId,
	line,
	idle,
	disabled,
}: Omit<readItemLineInputsFx.Props, "runtime"> & {
	readonly idle: boolean;
	readonly disabled: boolean;
}) => {
	const game = useGameEngine();
	const translator = useTranslator();
	const controller = useItemLineInputController({
		ownerItemId,
		lineUid: line.uid,
		disabled,
	});
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type) => {
			const result = game.readFn(
				readItemLineInputsFx({
					ownerItemId,
					line,
					runtime,
				}),
			);
			if (Exit.isFailure(result)) throw result.cause;
			const liveLine = runtime.items
				.find((item) => item.id === ownerItemId)
				?.item.lines.find((candidate) => candidate.uid === line.uid);
			return result.value.filter((input) => {
				const requirement = (liveLine ?? line).input[input.inputIndex];
				return requirement.type !== "units" || requirement.query.distance !== "self";
			});
		},
		[
			game,
			ownerItemId,
			line,
		],
	);
	const inputs = useRuntimeSelector(game, selectorFn, Equal.equals);
	if (inputs.length === 0) return null;
	return (
		<div
			className="flex flex-wrap items-center gap-3"
			data-ui="ItemLineInputs"
		>
			{inputs.map((input) => {
				const item = game.config.items[input.itemUid];
				const total = input.quantity.max;
				const unavailable =
					input.filled === 0 && input.availableQuantity === 0 && !input.committed;
				const colorFraction = input.committed ? 1 : input.filled / total;
				const status = match(input)
					.with(
						{
							committed: true,
							type: "units",
						},
						() => translator.textFn("Units already spent for this job."),
					)
					.with(
						{
							committed: true,
						},
						() => translator.textFn("In use for this job."),
					)
					.when(
						({ filled, quantity }) => filled > 0 && filled >= quantity.min,
						() => translator.textFn("Ready for this job."),
					)
					.with(
						{
							filled: P.number.gt(0),
							available: true,
						},
						() => translator.textFn("Partly ready. More is available."),
					)
					.with(
						{
							filled: P.number.gt(0),
						},
						() => translator.textFn("Partly ready. You'll need to find more."),
					)
					.with(
						{
							available: true,
						},
						() => translator.textFn("Available for this job."),
					)
					.otherwise(() => translator.textFn("None available right now."));
				return (
					<Tooltip
						key={input.inputIndex}
						content={
							<span className="block max-w-64">
								<strong className="block font-bold">{item.title}</strong>
								{input.type === "units" && input.distance !== "self" ? (
									<span className="block">
										{translator.textFn(
											BoardDistancePresentation[input.distance].label,
										)}
										:{" "}
										{translator.textFn(
											BoardDistancePresentation[input.distance].description,
										)}
									</span>
								) : null}
								<span className="block">{status}</span>
								{input.canWithdraw && !disabled ? (
									<span className="block">
										{translator.textFn("Right click to take one back.")}
									</span>
								) : null}
								{input.canAutofill && !disabled ? (
									<span className="block">
										{translator.textFn("Left click to bring this here.")}
									</span>
								) : null}
								{input.availableQuantity > 0 ? (
									<span className="block">
										{translator.textFn("Available")}:{" "}
										<strong className="font-bold">
											{input.availableQuantity}
										</strong>
									</span>
								) : null}
							</span>
						}
					>
						<button
							type="button"
							disabled={
								disabled ||
								controller.pending ||
								(!input.canWithdraw && !input.canAutofill)
							}
							onClick={() => {
								if (input.canAutofill)
									controller.activateFn(input.inputIndex, "autofill");
							}}
							onContextMenu={(event) => {
								event.preventDefault();
								event.stopPropagation();
								if (input.canWithdraw)
									controller.activateFn(input.inputIndex, "withdraw");
							}}
							className="relative block cursor-pointer disabled:cursor-default"
							data-input-index={input.inputIndex}
						>
							<span
								className="block transition-opacity duration-300 ease-out data-[ui-dimmed=true]:opacity-45"
								{...readDataUiFn({
									dataUi: "ItemLineInput",
									state: {
										dimmed: idle || input.filled === 0,
									},
								})}
							>
								<ItemArtwork
									className="size-20"
									sourceUrl={game.getResourceUrlFn(item.artwork.default[0])}
									compositeUrl={
										item.artwork.default[1] === undefined
											? undefined
											: game.getResourceUrlFn(item.artwork.default[1])
									}
									colorFraction={colorFraction}
								/>
							</span>
							{input.clock !== undefined ? (
								<ItemLineInputClock clock={input.clock} />
							) : null}
							{total > 1 ? (
								<span className="pointer-events-none absolute right-2 bottom-2 z-30 rounded-full bg-surface px-1.5 py-0.5 text-xs font-semibold text-foreground shadow-sm">
									{input.filled}/{total}
								</span>
							) : null}
							{input.type === "units" && input.distance !== "self" ? (
								<span
									className="pointer-events-none absolute -bottom-2 left-1/2 z-30 -translate-x-1/2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-accent-contrast"
									data-ui="ItemLineInputDistance"
								>
									{translator.textFn(
										BoardDistancePresentation[input.distance].label,
									)}
								</span>
							) : null}
							<span
								className="pointer-events-none absolute top-2 right-2 z-30 grid size-5 scale-75 place-items-center text-danger opacity-0 transition-[opacity,scale] duration-300 ease-out data-[ui-unavailable=true]:scale-100 data-[ui-unavailable=true]:opacity-100"
								{...readDataUiFn({
									dataUi: "ItemLineInputUnavailable",
									state: {
										unavailable,
									},
								})}
							>
								<X
									className="size-5"
									strokeWidth={3}
								/>
							</span>
						</button>
					</Tooltip>
				);
			})}
		</div>
	);
};

/** Mirrors the Board clock's track and hands without exposing an exact countdown. */
const ItemLineInputClock = ({
	clock,
}: {
	readonly clock: NonNullable<readItemLineInputsFx.Input["clock"]>;
}) => {
	const progress = Math.max(0, Math.min(1, 1 - clock.remainingMs / clock.durationMs));
	return (
		<svg
			data-ui="ItemLineInputClock"
			className="pointer-events-none absolute -top-1 -left-1 z-30 size-6 rounded-full bg-overlay/70 text-overlay-foreground"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.6}
		>
			<circle
				cx={12}
				cy={12}
				r={9}
				opacity={0.2}
			/>
			<circle
				cx={12}
				cy={12}
				r={9}
				pathLength={100}
				strokeDasharray={100}
				strokeDashoffset={(1 - progress) * 100}
				transform="rotate(-90 12 12)"
				className="transition-[stroke-dashoffset] duration-100 ease-linear"
			/>
			<path
				d="M12 7.5 V12 l3.15 1.8"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
};
