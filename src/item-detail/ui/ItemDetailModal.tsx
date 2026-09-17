import { match } from "ts-pattern";

import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";
import { ItemDetailDialog } from "~/item-detail/ui/ItemDetailDialog";

import "./item-detail.css";

/** Renders the one active Item Detail modal over the unchanged tile scene. */
export const ItemDetailModal = () => {
	const itemDetail = useItemDetailControl();
	return match(itemDetail.state)
		.with(
			{
				phase: "closed",
			},
			() => null,
		)
		.with(
			{
				phase: "entering",
			},
			{
				phase: "open",
			},
			{
				phase: "exiting",
			},
			(state) => <ItemDetailDialog state={state} />,
		)
		.exhaustive();
};
