import { type FC, useEffect, useRef } from "react";
import { cn } from "~/shared/cn";
import type { ViewItem } from "~/play/logic/playTypes";
import type { FlyerModel } from "~/play/types";
import { playFlyerTimeline } from "~/play/util/animation";
import { GameItemView } from "~/item/ui/GameItemView";

export namespace Flyer {
	export interface Props {
		flyer: FlyerModel;
		item: ViewItem;
		crossFadeItem?: ViewItem;
		onSettle(id: string): void;
	}
}

export const Flyer: FC<Flyer.Props> = ({ flyer, item, crossFadeItem, onSettle }) => {
	const ref = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const element = ref.current;
		if (!element) return () => onSettle(flyer.id);

		void playFlyerTimeline(element, flyer).finally(() => onSettle(flyer.id));

		return () => onSettle(flyer.id);
	}, [
		flyer,
		onSettle,
	]);

	return (
		<div
			ref={ref}
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
					producer={flyer.producer ?? undefined}
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
