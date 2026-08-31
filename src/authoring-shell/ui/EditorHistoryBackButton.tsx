import type { AnyRouter, RegisteredRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { ButtonLink, type ButtonLinkProps } from "~/ui/ui/Button";
import { useEditorHistoryBack } from "~/authoring-shell/ui/useEditorHistoryBack";

const editorBackLinkClassName =
	"min-h-0 shrink-0 border-0 bg-transparent p-1 shadow-none hover:border-transparent hover:bg-transparent active:bg-transparent";

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
			{props.children ?? <ArrowLeft className="size-7" />}
		</ButtonLink>
	);
};
