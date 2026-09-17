import { X } from "lucide-react";

import { ItemIdentity } from "~/ui/ui/ItemIdentity";
import { useCloseItemDetail } from "~/item-detail-frame/ui/useCloseItemDetail";

interface ItemDetailHeaderIdentity {
	readonly title: string;
	readonly sourceUrl: string;
	readonly compositeUrl?: string;
}

/** Renders the stable Item Detail identity and close control. */
export const ItemDetailHeader = ({
	disabled,
	identity,
	stale,
}: {
	readonly disabled: boolean;
	readonly identity: ItemDetailHeaderIdentity;
	readonly stale: boolean;
}) => {
	const closeItemDetailFn = useCloseItemDetail();
	const identityNode = (
		<ItemIdentity
			artworkDataUi="ItemDetailHeaderArtwork"
			compositeUrl={identity.compositeUrl}
			description={
				stale ? (
					<p className="mt-1 text-xs font-medium text-warning">
						This item no longer exists. Showing the last known detail.
					</p>
				) : null
			}
			size="lg"
			sourceUrl={identity.sourceUrl}
			title={identity.title}
			titleClassName="truncate text-lg font-semibold leading-tight"
			titleTag="h2"
		/>
	);
	return (
		<header className="flex min-w-0 items-center justify-between gap-4 border-b border-line pb-3">
			{identityNode}
			<button
				type="button"
				className="grid size-14 shrink-0 cursor-pointer place-items-center bg-transparent text-foreground transition-[color,transform] hover:scale-110 hover:text-accent disabled:cursor-not-allowed"
				data-ui="ItemDetailCloseButton"
				disabled={disabled}
				onClick={() => closeItemDetailFn()}
			>
				<X className="size-10" />
			</button>
		</header>
	);
};
