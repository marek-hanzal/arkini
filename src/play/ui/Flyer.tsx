import { type FC, useEffect } from "react";
import { useAnimate } from "motion/react";
import { GameItemView } from "~/item/ui/GameItemView";
import type { ViewItem } from "~/play/logic/playTypes";
import type { FlyerModel } from "~/play/types";
import { cn } from "~/shared/cn";

const flyDurationSeconds = 0.32;
const stashExitSeconds = 0.1;
const fadeOutSeconds = 0.14;
const consumeDurationSeconds = 0.18;
const mergeCrossFadeSeconds = 0.18;

export namespace Flyer {
	export interface Props {
		flyer: FlyerModel;
		item: ViewItem;
		crossFadeItem?: ViewItem;
		onSettle(id: string): void;
	}
}

export const Flyer: FC<Flyer.Props> = ({ flyer, item, crossFadeItem, onSettle }) => {
	const [scope, animate] = useAnimate<HTMLDivElement>();

	useEffect(() => {
		const element = scope.current;
		let cancelled = false;

		if (!element) {
			onSettle(flyer.id);
			return;
		}

		const run = async () => {
			const x = flyer.to.left - flyer.from.left;
			const y = flyer.to.top - flyer.from.top;
			const scaleX = flyer.from.width > 0 ? flyer.to.width / flyer.from.width : 1;
			const scaleY = flyer.from.height > 0 ? flyer.to.height / flyer.from.height : 1;
			const exitY = y + 34;
			const crossFadeFrom = element.querySelector<HTMLElement>(
				"[data-ak-fly-crossfade-from]",
			);
			const crossFadeTo = element.querySelector<HTMLElement>("[data-ak-fly-crossfade-to]");

			element.style.transformOrigin = "top left";

			if (crossFadeFrom) crossFadeFrom.style.transformOrigin = "center";
			if (crossFadeTo) crossFadeTo.style.transformOrigin = "center";

			if (flyer.kind === "stash") {
				await animate(
					element,
					{
						x,
						y,
						scaleX,
						scaleY,
						opacity: 1,
					},
					{
						duration: flyDurationSeconds - stashExitSeconds,
						ease: [
							0.22,
							1,
							0.36,
							1,
						],
					},
				);
				await animate(
					element,
					{
						y: exitY,
						opacity: 0,
					},
					{
						duration: stashExitSeconds,
						ease: [
							0.32,
							0,
							0.67,
							0,
						],
					},
				);
				return;
			}

			if (flyer.kind === "deplete") {
				element.style.transformOrigin = "center";
				await animate(
					element,
					{
						y: -8,
						scaleX: 0.72,
						scaleY: 0.72,
						opacity: 0,
					},
					{
						duration: 0.24,
						ease: [
							0.32,
							0,
							0.67,
							0,
						],
					},
				);
				return;
			}

			if (flyer.kind === "merge-crossfade") {
				await Promise.all([
					crossFadeFrom
						? animate(
								crossFadeFrom,
								{
									opacity: 0,
								},
								{
									duration: mergeCrossFadeSeconds,
									ease: "linear",
								},
							)
						: Promise.resolve(),
					crossFadeTo
						? animate(
								crossFadeTo,
								{
									opacity: 1,
								},
								{
									duration: mergeCrossFadeSeconds,
									ease: "linear",
								},
							)
						: Promise.resolve(),
				]);
				return;
			}

			if (flyer.kind === "fade-out") {
				await animate(
					element,
					{
						opacity: 0,
					},
					{
						duration: fadeOutSeconds,
						ease: "linear",
					},
				);
				return;
			}

			if (flyer.kind === "consume") {
				element.style.transformOrigin = "center";
				await animate(
					element,
					{
						scaleX: 0.34,
						scaleY: 0.34,
						opacity: 0,
					},
					{
						duration: consumeDurationSeconds,
						ease: [
							0.32,
							0,
							0.67,
							0,
						],
					},
				);
				return;
			}

			if (flyer.kind === "imprint-source") {
				element.style.transformOrigin = "top left";
				await animate(
					element,
					{
						x,
						y,
						scaleX: scaleX * 0.82,
						scaleY: scaleY * 0.82,
						opacity: 0,
					},
					{
						duration: 0,
					},
				);
				await animate(
					element,
					{
						scaleX: scaleX * 1.18,
						scaleY: scaleY * 1.18,
						opacity: 1,
					},
					{
						duration: 0.18,
						ease: [
							0.34,
							1.56,
							0.64,
							1,
						],
					},
				);
				await animate(
					element,
					{
						scaleX,
						scaleY,
					},
					{
						duration: 0.18,
						ease: "easeOut",
					},
				);
				return;
			}

			await animate(
				element,
				{
					x,
					y,
					scaleX,
					scaleY,
					opacity: 1,
				},
				{
					duration: flyDurationSeconds,
					ease: [
						0.22,
						1,
						0.36,
						1,
					],
				},
			);
		};

		void run()
			.catch((error: unknown) => {
				if (import.meta.env.DEV) console.debug("Flyer animation cancelled", error);
			})
			.finally(() => {
				if (!cancelled) onSettle(flyer.id);
			});

		return () => {
			cancelled = true;
		};
	}, [
		animate,
		flyer,
		onSettle,
		scope,
	]);

	return (
		<div
			ref={scope}
			className={cn("ak-fly pointer-events-none fixed z-50", `ak-fly--${flyer.kind}`)}
			style={{
				left: flyer.from.left,
				top: flyer.from.top,
				width: flyer.from.width,
				height: flyer.from.height,
			}}
		>
			<div
				data-ak-fly-crossfade-from
				className={cn(crossFadeItem && "absolute inset-0")}
			>
				<GameItemView
					item={item}
					variant="flyer"
					quantity={flyer.quantity}
					activation={flyer.activation ?? undefined}
				/>
			</div>
			{crossFadeItem ? (
				<div
					data-ak-fly-crossfade-to
					className="absolute inset-0 opacity-0"
				>
					<GameItemView
						item={crossFadeItem}
						variant="flyer"
					/>
				</div>
			) : null}
		</div>
	);
};
