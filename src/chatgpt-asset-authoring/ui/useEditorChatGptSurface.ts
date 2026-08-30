import { Effect } from "effect";
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
	ChatGptViewStateSchema,
	type ChatGptViewStateSchema as ChatGptViewStateSchemaType,
} from "../../../electron/contract/chatgpt/ChatGptSurfaceSchema";
import type { ChatGptSurfaceSchema } from "../../../electron/contract/chatgpt/ChatGptSurfaceSchema";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";

type ChatGptViewState = ChatGptViewStateSchemaType.Type;

const setChatGptSurfaceFx = Effect.fn("setChatGptSurfaceFx")(
	(surface: ChatGptSurfaceSchema.Type | null) =>
		Effect.tryPromise({
			try: () => window.arkini.chatGpt.setSurface(surface),
			catch: (cause) => cause,
		}),
);

const subscribeChatGptViewStateFx = Effect.fn("subscribeChatGptViewStateFx")(
	(listener: (state: ChatGptViewState) => void) =>
		Effect.sync(() =>
			window.arkini.chatGpt.onStateChanged((candidate) =>
				listener(ChatGptViewStateSchema.parse(candidate)),
			),
		),
);

export namespace useEditorChatGptSurface {
	export interface Props {
		readonly projectId: string;
		readonly visible: boolean;
	}

	export interface Output {
		readonly retry: () => void;
		readonly surfaceRef: RefObject<HTMLDivElement | null>;
		readonly viewState: ChatGptViewState;
	}
}

/** Owns placement, state subscription, detach, and retry for the native browser surface. */
export const useEditorChatGptSurface = ({
	projectId,
	visible,
}: useEditorChatGptSurface.Props): useEditorChatGptSurface.Output => {
	const surfaceRef = useRef<HTMLDivElement>(null);
	const [viewState, setViewState] = useState<ChatGptViewState>({
		type: "loading",
	});
	const [retryKey, setRetryKey] = useState(0);

	useEffect(
		() =>
			RendererRuntime.runSync(
				subscribeChatGptViewStateFx((state) => {
					setViewState(state);
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
		const publish = () => {
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
				setViewState({
					type: "unavailable",
					message: error instanceof Error ? error.message : String(error),
				});
			});
		};
		const observer = new ResizeObserver(publish);
		observer.observe(element);
		window.addEventListener("resize", publish);
		publish();
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", publish);
			void RendererRuntime.runPromise(setChatGptSurfaceFx(null));
		};
	}, [
		projectId,
		retryKey,
		visible,
	]);

	const retry = useCallback(() => {
		setViewState({
			type: "loading",
		});
		setRetryKey((current) => current + 1);
	}, []);

	return {
		retry,
		surfaceRef,
		viewState,
	};
};
