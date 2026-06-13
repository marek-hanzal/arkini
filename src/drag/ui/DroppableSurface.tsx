import { useDroppable, type Data } from "@dnd-kit/core";
import { type FC, useCallback, type HTMLAttributes, type ReactNode } from "react";
import type { DroppablePayload } from "~/drag/hook/useDraggableControl";

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

export const DroppableSurface: FC<DroppableSurface.Props> = ({
	id,
	nodeId = id,
	payload,
	className,
	children,
	nodeRef,
	...props
}) => {
	const data = {
		...payload,
		targetNodeId: payload.targetNodeId ?? nodeId,
	} satisfies DroppablePayload<unknown>;
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
};
