import type { ComponentType, ReactNode } from "react";

import { ItemIdentity } from "~/ui/item/ItemIdentity";
import { useCloseItemDetail } from "~/ui/item-detail/useCloseItemDetail";

export interface ItemDetailHeaderIdentity {
	readonly definitionId: string;
	readonly title: string;
	readonly sourceUrl: string;
	readonly compositeUrl?: string;
}

export interface ItemDetailHeaderIdentityRenderProps {
	readonly children: ReactNode;
	readonly disabled: boolean;
	readonly itemId: string;
}

export type ItemDetailHeaderIdentityRenderer = ComponentType<ItemDetailHeaderIdentityRenderProps>;

/** Renders the stable Item Detail identity and close control around an optional host-owned link. */
export const ItemDetailHeader = ({
	disabled,
	identity,
	renderIdentity,
	stale,
}: {
	readonly disabled: boolean;
	readonly identity: ItemDetailHeaderIdentity;
	readonly renderIdentity?: ItemDetailHeaderIdentityRenderer;
	readonly stale: boolean;
}) => {
	const closeItemDetail = useCloseItemDetail();
	const IdentityRenderer = renderIdentity;
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
			titleId="item-detail-title"
			titleTag="h2"
		/>
	);
	return (
		<header className="flex min-w-0 items-center justify-between gap-4 border-b border-line pb-3">
			{IdentityRenderer === undefined ? (
				identityNode
			) : (
				<IdentityRenderer
					disabled={disabled}
					itemId={identity.definitionId}
				>
					{identityNode}
				</IdentityRenderer>
			)}
			<button
				type="button"
				className="grid size-14 shrink-0 cursor-pointer place-items-center bg-transparent text-foreground transition-[color,transform] hover:scale-110 hover:text-accent disabled:cursor-not-allowed"
				aria-label="Close item detail"
				data-ui="ItemDetailCloseButton"
				disabled={disabled}
				onClick={() => closeItemDetail()}
			>
				<span
					className="icon-[lucide--x] size-10"
					aria-hidden="true"
				/>
			</button>
		</header>
	);
};
