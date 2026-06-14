import type { FC } from "react";
import { useFlyers } from "~/play/hook/useFlyers";
import { usePlayItems } from "~/play/hook/usePlayItems";
import { Flyer } from "~/play/ui/Flyer";

export namespace FlyerLayer {
	export interface Props {
		flyers: ReturnType<typeof useFlyers>["flyers"];
		onSettle(id: string): void;
	}
}

export const FlyerLayer: FC<FlyerLayer.Props> = ({ flyers, onSettle }) => {
	const items = usePlayItems().data;

	if (!items) return null;

	return flyers.map((flyer) => {
		const item = items[flyer.itemId];
		const crossFadeItem = flyer.crossFadeItemId
			? items[flyer.crossFadeItemId]
			: undefined;

		return item ? (
			<Flyer
				key={flyer.id}
				flyer={flyer}
				item={item}
				crossFadeItem={crossFadeItem}
				onSettle={onSettle}
			/>
		) : null;
	});
};
