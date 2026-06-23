import type { FC } from "react";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import { UiButton } from "~/v0/ui/UiButton";
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
		<div className="flex items-stretch gap-3">
			<div className="flex w-[6.75rem] max-w-[34vw] shrink-0 items-stretch rounded-sm bg-ak-surface-soft p-2">
				<div className="h-full w-full">
					<GameItemView
						item={item}
						variant="inventory"
					/>
				</div>
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-start justify-between gap-3">
					<h2 className="min-w-0 flex-1 break-words text-base font-bold leading-6 text-ak-text">
						{item.name}
					</h2>
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
				<p className="mt-2 break-words text-sm leading-6 text-ak-text-muted">
					{item.description}
				</p>
			</div>
		</div>
	</div>
);
