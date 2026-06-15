import { createContext } from "react";
import type { usePlayDraggableControl } from "~/play/hook/usePlayDraggableControl";

export const PlayDragContext = createContext<ReturnType<typeof usePlayDraggableControl> | null>(
	null,
);
