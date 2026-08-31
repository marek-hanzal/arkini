import { Effect } from "effect";
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChatGptViewStateSchema } from "~electron/contract/chatgpt/ChatGptSurfaceSchema";
import type { ChatGptSurfaceSchema } from "~electron/contract/chatgpt/ChatGptSurfaceSchema";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";

const setChatGptSurfaceFx = Effect.fn("setChatGptSurfaceFx")(
	(surface: ChatGptSurfaceSchema.Type | null) =>
		Effect.tryPromise({
			try: () => window.arkini.chatGpt.setSurfaceFn(surface),
			catch: (cause) => cause,
		}),
);

const subscribeChatGptViewStateFx = Effect.fn("subscribeChatGptViewStateFx")(
	(listenerFn: (state: ChatGptViewStateSchema.Type) => void) =>
		Effect.sync(() =>
			window.arkini.chatGpt.onStateChangedFn((candidate) =>
				listenerFn(ChatGptViewStateSchema.parse(candidate)),
			),
		),
);

interface UseEditorChatGptSurfaceProps {
	readonly projectId: string;
	readonly visible: boolean;
}

interface UseEditorChatGptSurfaceOutput {
	readonly retryFn: () => void;
	readonly surfaceRef: RefObject<HTMLDivElement | null>;
	readonly viewState: ChatGptViewStateSchema.Type;
}

/** Owns placement, state subscription, detach, and retry for the native browser surface. */
export const useEditorChatGptSurface = ({
	projectId,
	visible,
}: UseEditorChatGptSurfaceProps): UseEditorChatGptSurfaceOutput => {
	const surfaceRef = useRef<HTMLDivElement>(null);
	const [viewState, setViewStateFn] = useState<ChatGptViewStateSchema.Type>({
		type: "loading",
	});
	const [retryKey, setRetryKeyFn] = useState(0);

	useEffect(
		() =>
			RendererRuntime.runSync(
				subscribeChatGptViewStateFx((state) => {
					setViewStateFn(state);
				}),
			),
		[],
	);

	useLayoutEffect(() => {
		const element = surfaceRef.current;
		if (element === null || !visible) {
			void RendererRuntime.runPromise(setChatGptSurfaceFx(null));
			return;
		}
		let previousBounds = "";
		const publishFn = () => {
			const rect = element.getBoundingClientRect();
			const bounds = {
				x: Math.max(0, Math.round(rect.x)),
				y: Math.max(0, Math.round(rect.y)),
				width: Math.max(0, Math.round(rect.width)),
				height: Math.max(0, Math.round(rect.height)),
			};
			const identity = `${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}`;
			if (identity === previousBounds) return;
			previousBounds = identity;
			void RendererRuntime.runPromise(
				setChatGptSurfaceFx({
					projectId,
					bounds,
				}),
			).catch((error) => {
				setViewStateFn({
					type: "unavailable",
					message: error instanceof Error ? error.message : String(error),
				});
			});
		};
		const observer = new ResizeObserver(publishFn);
		observer.observe(element);
		window.addEventListener("resize", publishFn);
		publishFn();
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", publishFn);
			void RendererRuntime.runPromise(setChatGptSurfaceFx(null));
		};
	}, [
		projectId,
		retryKey,
		visible,
	]);

	const retryFn = useCallback(() => {
		setViewStateFn({
			type: "loading",
		});
		setRetryKeyFn((current) => current + 1);
	}, []);

	return {
		retryFn,
		surfaceRef,
		viewState,
	};
};
