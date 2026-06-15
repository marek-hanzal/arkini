import { createContext, type RefObject } from "react";

export const PlayRootElementContext = createContext<RefObject<HTMLElement | null> | null>(null);
