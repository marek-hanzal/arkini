import { useDroppable, type Data } from "@dnd-kit/core";
import { memo, type FC, useCallback, type HTMLAttributes, useMemo, type ReactNode } from "react";
import type { DroppablePayload } from "~/drag/DroppablePayload";

export namespace DroppableSurface {
	export interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "className" | "children"> {
		id: string;
		nodeId?: string;
		payload: DroppablePayload<unknown>;
		className?: string | ((isOver: boolean) => string);
		nodeRef?(node: HTMLDivElement | null): void;
		children: ReactNode;
	}
}

export const DroppableSurface: FC<DroppableSurface.Props> = memo(
	({ id, nodeId = id, payload, className, children, nodeRef, ...props }) => {
		const data = useMemo(
			() =>
				({
					...payload,
					targetNodeId: payload.targetNodeId ?? nodeId,
				}) satisfies DroppablePayload<unknown>,
			[
				nodeId,
				payload,
			],
		);
		const { setNodeRef, isOver } = useDroppable({
			id,
			data: data as unknown as Data,
		});
		const setRefs = useCallback(
			(node: HTMLDivElement | null) => {
				setNodeRef(node);
				nodeRef?.(node);
			},
			[
				nodeRef,
				setNodeRef,
			],
		);

		return (
			<div
				ref={setRefs}
				data-drag-node-id={nodeId}
				className={typeof className === "function" ? className(isOver) : className}
				{...props}
			>
				{children}
			</div>
		);
	},
);
