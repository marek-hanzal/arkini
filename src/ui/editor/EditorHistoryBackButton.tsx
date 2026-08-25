import type { AnyRouter, RegisteredRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { ButtonLink, type ButtonLinkProps } from "~/ui/button/Button";
import { editorBackLinkClassName, EditorBackIcon } from "~/ui/editor/EditorBackIcon";
import { useEditorHistoryBack } from "~/ui/editor/useEditorHistoryBack";

/** Presents the shared editor back action without inventing per-page navigation semantics. */
export const EditorHistoryBackButton = <
	TRouter extends AnyRouter = RegisteredRouter,
	const TFrom extends string = string,
	const TTo extends string | undefined = undefined,
	const TMaskFrom extends string = TFrom,
	const TMaskTo extends string = "",
>(
	props: ButtonLinkProps<TRouter, TFrom, TTo, TMaskFrom, TMaskTo> & {
		readonly children?: ReactNode;
	},
) => {
	const historyBack = useEditorHistoryBack();
	return (
		<ButtonLink<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>
			{...props}
			className={props.className ?? editorBackLinkClassName}
			onClick={(event) => {
				if (
					event.defaultPrevented ||
					event.button !== 0 ||
					event.metaKey ||
					event.ctrlKey ||
					event.shiftKey ||
					event.altKey ||
					(event.currentTarget.target !== "" && event.currentTarget.target !== "_self") ||
					event.currentTarget.hasAttribute("download")
				) {
					props.onClick?.(event);
					return;
				}
				if (historyBack(() => props.onClick?.(event))) event.preventDefault();
			}}
			preload={false}
			replace
		>
			{props.children ?? <EditorBackIcon />}
		</ButtonLink>
	);
};
