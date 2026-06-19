import type { FC } from "react";
import { UiButton } from "~/v0/ui/UiButton";
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
	<div className="rounded-sm border border-ak-border bg-ak-surface-elevated p-3.5">
		<div className="flex min-w-0 gap-3">
			<div className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-sm bg-ak-surface-soft">
				<GameItemView
					item={item}
					variant="inventory"
				/>
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-start justify-between gap-3">
					<div className="min-w-0">
						<h2 className="truncate text-base font-bold text-ak-text">{item.name}</h2>
						<p className="mt-1 break-words text-sm leading-6 text-ak-text-muted">
							{item.description}
						</p>
					</div>
					{onStore ? (
						<UiButton
							data-ui="store action"
							fullWidth={false}
							disabled={storeDisabled}
							onClick={onStore}
						>
							Store
						</UiButton>
					) : null}
				</div>
			</div>
		</div>
	</div>
);
