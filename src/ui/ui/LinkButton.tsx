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
} from "react";
import { twMerge } from "tailwind-merge";

import { CursorClassName, type CursorSemantic } from "~/ui/type/CursorSemantic";

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

const LinkButtonAnchor = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
	({ className, ...props }, ref) => (
		<a
			ref={ref}
			className={twMerge(LinkButtonClassName, CursorClassName.pointer, className)}
			{...props}
		/>
	),
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
		preload: props.preload ?? "intent",
	} as never)) as LinkComponent<typeof LinkButtonAnchor>;
