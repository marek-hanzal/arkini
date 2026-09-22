import {
	type AnyRouter,
	createLink,
	type LinkComponent,
	type LinkComponentProps,
	type RegisteredRouter,
} from "@tanstack/react-router";
import {
	createElement,
	forwardRef,
	type AnchorHTMLAttributes,
	type ButtonHTMLAttributes,
	type MouseEventHandler,
} from "react";
import { twMerge } from "tailwind-merge";

import { CursorClassName, type CursorSemantic } from "~/ui/type/CursorSemantic";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

type LinkButtonCursorIntent = Extract<
	CursorSemantic,
	"not-allowed" | "pointer" | "progress" | "wait"
>;

interface LinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	readonly cursorIntent?: LinkButtonCursorIntent;
}

const LinkButtonClassName =
	"inline border-0 bg-transparent p-0 font-medium text-accent no-underline decoration-accent/55 underline-offset-2 transition-colors hover:text-accent-hover hover:underline disabled:text-muted disabled:hover:no-underline";

/** Renders a native button with the canonical inline-link affordance. */
export const LinkButton = forwardRef<HTMLButtonElement, LinkButtonProps>(
	({ className, cursorIntent = "pointer", disabled, type = "button", ...props }, ref) => (
		<button
			ref={ref}
			type={type}
			disabled={disabled}
			className={twMerge(
				LinkButtonClassName,
				CursorClassName[
					disabled && cursorIntent !== "progress" && cursorIntent !== "wait"
						? "not-allowed"
						: cursorIntent
				],
				className,
			)}
			{...props}
		/>
	),
);
LinkButton.displayName = "LinkButton";

type LinkButtonAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
	readonly linkDisabled?: boolean;
	readonly "data-ui"?: string;
};

const LinkButtonAnchor = forwardRef<HTMLAnchorElement, LinkButtonAnchorProps>(
	({ className, linkDisabled = false, onClick: onClickFn, ...props }, ref) => {
		const handleClickFn: MouseEventHandler<HTMLAnchorElement> = (event) => {
			if (linkDisabled) {
				event.preventDefault();
				return;
			}
			onClickFn?.(event);
		};
		return (
			<a
				ref={ref}
				className={twMerge(
					LinkButtonClassName,
					"data-[ui-disabled=true]:text-muted data-[ui-disabled=true]:hover:text-muted data-[ui-disabled=true]:hover:no-underline",
					CursorClassName[linkDisabled ? "not-allowed" : "pointer"],
					className,
				)}
				{...props}
				onClick={handleClickFn}
				{...readDataUiFn({
					dataUi: props["data-ui"] ?? "LinkButtonLink",
					state: {
						disabled: linkDisabled,
					},
				})}
			/>
		);
	},
);
LinkButtonAnchor.displayName = "LinkButtonAnchor";

const CreatedLinkButtonLink = createLink(LinkButtonAnchor);

export type LinkButtonLinkProps<
	TRouter extends AnyRouter = RegisteredRouter,
	TFrom extends string = string,
	TTo extends string | undefined = undefined,
	TMaskFrom extends string = TFrom,
	TMaskTo extends string = "",
> = LinkComponentProps<typeof LinkButtonAnchor, TRouter, TFrom, TTo, TMaskFrom, TMaskTo>;

/** Renders a routed anchor with the canonical inline-link affordance. */
export const LinkButtonLink = ((props: LinkButtonLinkProps) =>
	createElement(CreatedLinkButtonLink, {
		...props,
		disabled: undefined,
		linkDisabled: props.disabled,
		preload: props.preload ?? "intent",
	} as never)) as LinkComponent<typeof LinkButtonAnchor>;
