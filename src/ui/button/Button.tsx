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

import { CursorClassName, type CursorSemantic } from "~/ui/cursor/CursorSemantic";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

const ButtonBaseClassName =
	"inline-flex min-h-[var(--ak-control-min-height)] items-center justify-center rounded-lg px-[var(--ak-control-padding-inline)] py-[var(--ak-control-padding-block)] text-center text-[var(--ak-control-font-size)] font-semibold transition-colors disabled:opacity-60 data-[ui-disabled=true]:opacity-60";

const ButtonVariantClassNames = {
	default:
		"border border-line bg-surface/75 text-foreground shadow-lg hover:border-line-strong hover:bg-surface-raised active:bg-surface-raised disabled:hover:border-line disabled:hover:bg-surface/75 disabled:active:bg-surface/75 data-[ui-disabled=true]:hover:border-line data-[ui-disabled=true]:hover:bg-surface/75 data-[ui-disabled=true]:active:bg-surface/75",
	primary:
		"bg-accent text-accent-contrast shadow-lg hover:bg-accent-hover active:bg-accent-hover disabled:hover:bg-accent disabled:active:bg-accent data-[ui-disabled=true]:hover:bg-accent data-[ui-disabled=true]:active:bg-accent",
	danger: "bg-danger text-danger-contrast shadow-lg hover:opacity-90 active:opacity-80 disabled:hover:opacity-60 disabled:active:opacity-60 data-[ui-disabled=true]:hover:opacity-60 data-[ui-disabled=true]:active:opacity-60",
} as const;

type ButtonVariant = keyof typeof ButtonVariantClassNames;
type ControlCursorIntent = Extract<CursorSemantic, "pointer" | "progress" | "wait" | "not-allowed">;

interface ControlCursorProps {
	readonly cursorIntent?: ControlCursorIntent;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ControlCursorProps;

type ButtonAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> &
	ControlCursorProps & {
		readonly "data-ui"?: string;
		readonly linkDisabled?: boolean;
	};

const readControlCursorSemanticFn = ({
	disabled = false,
	intent = "pointer",
}: {
	readonly disabled?: boolean;
	readonly intent?: ControlCursorIntent;
}): ControlCursorIntent => {
	if (!disabled) return intent;
	return intent === "progress" || intent === "wait" ? intent : "not-allowed";
};

const createButton = (displayName: string, variant: ButtonVariant) => {
	const Component = forwardRef<HTMLButtonElement, ButtonProps>(
		({ className, cursorIntent, disabled, type = "button", ...props }, ref) => {
			const cursor = readControlCursorSemanticFn({
				disabled,
				intent: cursorIntent,
			});
			return (
				<button
					ref={ref}
					type={type}
					disabled={disabled}
					className={twMerge(
						ButtonBaseClassName,
						ButtonVariantClassNames[variant],
						CursorClassName[cursor],
						className,
					)}
					{...props}
				/>
			);
		},
	);
	Component.displayName = displayName;
	return Component;
};

const createButtonAnchor = (displayName: string, variant: ButtonVariant) => {
	const Component = forwardRef<HTMLAnchorElement, ButtonAnchorProps>(
		({ className, cursorIntent, linkDisabled = false, onClick, ...props }, ref) => {
			const cursor = readControlCursorSemanticFn({
				disabled: linkDisabled,
				intent: cursorIntent,
			});
			const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
				if (linkDisabled) {
					event.preventDefault();
					return;
				}
				onClick?.(event);
			};
			return (
				<a
					{...props}
					ref={ref}
					className={twMerge(
						ButtonBaseClassName,
						ButtonVariantClassNames[variant],
						CursorClassName[cursor],
						className,
					)}
					onClick={handleClick}
					{...readDataUiFn({
						dataUi: props["data-ui"] ?? displayName,
						state: {
							disabled: linkDisabled,
						},
					})}
				/>
			);
		},
	);
	Component.displayName = displayName;
	return Component;
};

/** Renders the canonical neutral game action on a native button. */
export const Button = createButton("Button", "default");

/** Renders the canonical primary game action on a native button. */
export const PrimaryButton = createButton("PrimaryButton", "primary");

/** Renders the canonical destructive game action on a native button. */
export const DangerButton = createButton("DangerButton", "danger");

const ButtonAnchor = createButtonAnchor("ButtonAnchor", "default");
const PrimaryButtonAnchor = createButtonAnchor("PrimaryButtonAnchor", "primary");
const DangerButtonAnchor = createButtonAnchor("DangerButtonAnchor", "danger");

const CreatedButtonLink = createLink(ButtonAnchor);
const CreatedPrimaryButtonLink = createLink(PrimaryButtonAnchor);
const CreatedDangerButtonLink = createLink(DangerButtonAnchor);

export type ButtonLinkProps<
	TRouter extends AnyRouter = RegisteredRouter,
	TFrom extends string = string,
	TTo extends string | undefined = undefined,
	TMaskFrom extends string = TFrom,
	TMaskTo extends string = "",
> = LinkComponentProps<typeof ButtonAnchor, TRouter, TFrom, TTo, TMaskFrom, TMaskTo>;

const createButtonLinkFn = (CreatedLink: LinkComponent<typeof ButtonAnchor>) =>
	((props: ButtonLinkProps) =>
		createElement(CreatedLink, {
			...props,
			disabled: undefined,
			linkDisabled: props.disabled,
			preload: props.preload ?? "intent",
		} as never)) as LinkComponent<typeof ButtonAnchor>;

/** Renders the canonical neutral game action with TanStack Router Link semantics. */
export const ButtonLink = createButtonLinkFn(CreatedButtonLink);

/** Renders the canonical primary game action with TanStack Router Link semantics. */
export const PrimaryButtonLink = createButtonLinkFn(CreatedPrimaryButtonLink);

/** Renders the canonical destructive game action with TanStack Router Link semantics. */
export const DangerButtonLink = createButtonLinkFn(CreatedDangerButtonLink);
