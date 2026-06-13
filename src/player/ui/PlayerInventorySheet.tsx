import type { FC } from "react";
import { usePlayPlayerInventory } from "~/play/hook/usePlayPlayerInventory";
import { ResourceRow } from "~/player/ui/ResourceRow";
import { SheetHeader } from "~/shared/ui/SheetHeader";

export namespace PlayerInventorySheet {
	export interface Props {
		onClose(): void;
	}
}

export const PlayerInventorySheet: FC<PlayerInventorySheet.Props> = ({ onClose }) => {
	const playerInventory = usePlayPlayerInventory().data;

	return (
		<div className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 flex-col">
			<SheetHeader
				eyebrow="Player"
				description="Resources and currencies"
				onClose={onClose}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
				<div className="ak-game-width mx-auto grid gap-2">
					{playerInventory?.resources.map((resource) => (
						<ResourceRow
							key={resource.id}
							resource={resource}
						/>
					))}
				</div>
			</div>
		</div>
	);
};
