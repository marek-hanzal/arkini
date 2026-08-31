import { match } from "ts-pattern";

import type { ItemDetailHeaderIdentityRenderer } from "~/item-detail-frame/ui/ItemDetailHeader";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";
import type { ItemLineSummaryIdentityRenderer } from "~/item-line-detail/ui/ItemLineSummary";
import { ItemDetailDialog } from "~/item-detail/ui/ItemDetailDialog";

import "./item-detail.css";

interface ItemDetailModalProps {
	readonly renderIdentity?: ItemDetailHeaderIdentityRenderer;
	readonly renderLineIdentity?: ItemLineSummaryIdentityRenderer;
}

/** Renders the one active Item Detail modal over the unchanged tile scene. */
export const ItemDetailModal = ({ renderIdentity, renderLineIdentity }: ItemDetailModalProps) => {
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
			(state) => (
				<ItemDetailDialog
					renderIdentity={renderIdentity}
					renderLineIdentity={renderLineIdentity}
					state={state}
				/>
			),
		)
		.exhaustive();
};
