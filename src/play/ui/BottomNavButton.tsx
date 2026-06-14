import { useDroppable, type Data } from "@dnd-kit/core";
import { memo, type FC, useCallback, useMemo } from "react";
import { inventoryNavDropTargetNodeId } from "~/inventory/inventoryNavDropTargetNodeId";
import type { BottomNavSheet } from "~/play/logic/playSheetTypes";
import type { DropData } from "~/play/types";

export namespace BottomNavButton {
	export interface Props {
		active: boolean;
		label: string;
		icon: string;
		tone: BottomNavSheet;
		dropTargetActive?: boolean;
		onOpen(sheet: BottomNavSheet): void;
	}
}

export const BottomNavButton: FC<BottomNavButton.Props> = memo(
	({ active, label, icon, tone, dropTargetActive = false, onOpen }) => {
		const handleClick = useCallback(
			() => onOpen(tone),
			[
				onOpen,
				tone,
			],
		);
		const isInventoryTarget = tone === "inventory";
		const dropId = isInventoryTarget ? inventoryNavDropTargetNodeId : `bottom-nav:${tone}`;
		const dropData = useMemo(
			() =>
				({
					targetId: dropId,
					targetNodeId: dropId,
					target: {
						kind: "inventory" as const,
					},
				}) satisfies DropData,
			[
				dropId,
			],
		);
		const { setNodeRef, isOver } = useDroppable({
			id: dropId,
			data: dropData as unknown as Data,
			disabled: !isInventoryTarget,
		});

		return (
			<button
				ref={setNodeRef}
				type="button"
				className="ak-bottom-nav-button"
				data-active={active ? "true" : "false"}
				data-tone={tone}
				data-bottom-nav-sheet={tone}
				data-drag-node-id={isInventoryTarget ? inventoryNavDropTargetNodeId : undefined}
				data-inventory-drop-target={isInventoryTarget ? "true" : undefined}
				data-drop-target-active={isInventoryTarget && dropTargetActive ? "true" : undefined}
				data-drop-over={isInventoryTarget && isOver ? "true" : undefined}
				onClick={handleClick}
			>
				<span className="ak-bottom-nav-icon">{icon}</span>
				<span>{label}</span>
			</button>
		);
	},
);
