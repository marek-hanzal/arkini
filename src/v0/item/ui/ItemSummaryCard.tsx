import type { FC } from "react";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import { GameItemView } from "./GameItemView";

export namespace ItemSummaryCard {
	export interface Props {
		item: ViewItem;
		storeDisabled?: boolean;
		onStore?(): void;
	}
}

export const ItemSummaryCard: FC<ItemSummaryCard.Props> = ({
	item,
	storeDisabled = false,
	onStore,
}) => (
	<div className="ak-ui-card flex min-w-0 gap-3 p-3">
		<div className="h-16 w-16 shrink-0 rounded-xl bg-pink-50/80">
			<GameItemView
				item={item}
				variant="inventory"
			/>
		</div>
		<div className="min-w-0 flex-1">
			<div className="flex min-w-0 items-start justify-between gap-3">
				<h2 className="min-w-0 truncate font-semibold text-ak-text">{item.name}</h2>
				{onStore ? (
					<button
						type="button"
						data-ui="store action"
						disabled={storeDisabled}
						onClick={onStore}
						className="ak-ui-button ak-ui-button-ghost min-h-10 shrink-0 px-3 text-xs"
					>
						Store
					</button>
				) : null}
			</div>
			<p className="ak-ui-muted mt-1 break-words text-xs leading-5">{item.description}</p>
		</div>
	</div>
);
