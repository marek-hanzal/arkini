import { createLink, type LinkComponent } from "@tanstack/react-router";
import { Effect } from "effect";
import {
	forwardRef,
	type AnchorHTMLAttributes,
	type ButtonHTMLAttributes,
	type MouseEventHandler,
} from "react";
import { twMerge } from "tailwind-merge";

import { CursorClassName, type CursorSemantic } from "~/ui/cursor/CursorSemantic";
import { readControlCursorSemanticFx } from "~/ui/cursor/readControlCursorSemanticFx";

const ButtonBaseClassName =
	"inline-flex min-h-[var(--ak-control-min-height)] items-center justify-center rounded-lg px-[var(--ak-control-padding-inline)] py-[var(--ak-control-padding-block)] text-center text-[var(--ak-control-font-size)] font-semibold transition-colors disabled:opacity-60 aria-disabled:opacity-60";

const ButtonVariantClassNames = {
	default:
		"border border-line bg-surface/75 text-foreground shadow-lg backdrop-blur-md hover:border-line-strong hover:bg-surface-raised active:bg-surface-raised disabled:hover:border-line disabled:hover:bg-surface/75 disabled:active:bg-surface/75 aria-disabled:hover:border-line aria-disabled:hover:bg-surface/75 aria-disabled:active:bg-surface/75",
	primary:
		"bg-accent text-accent-contrast shadow-lg hover:bg-accent-hover active:bg-accent-hover disabled:hover:bg-accent disabled:active:bg-accent aria-disabled:hover:bg-accent aria-disabled:active:bg-accent",
	danger: "bg-danger text-danger-contrast shadow-lg hover:opacity-90 active:opacity-80 disabled:hover:opacity-60 disabled:active:opacity-60 aria-disabled:hover:opacity-60 aria-disabled:active:opacity-60",
} as const;

type ButtonVariant = keyof typeof ButtonVariantClassNames;
type ControlCursorIntent = Extract<CursorSemantic, "pointer" | "progress" | "wait" | "not-allowed">;

interface ControlCursorProps {
	readonly cursorIntent?: ControlCursorIntent;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ControlCursorProps;

type ButtonAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & ControlCursorProps;

interface ButtonFactoryProps {
	readonly displayName: string;
	readonly variant: ButtonVariant;
}

const createButtonFx = Effect.fn("createButtonFx")(({ displayName, variant }: ButtonFactoryProps) =>
	Effect.sync(() => {
		const Component = forwardRef<HTMLButtonElement, ButtonProps>(
			({ className, cursorIntent, disabled, type = "button", ...props }, ref) => {
				const ariaDisabled =
					props["aria-disabled"] === true || props["aria-disabled"] === "true";
				const cursor = Effect.runSync(
					readControlCursorSemanticFx({
						ariaDisabled,
						disabled,
						intent: cursorIntent,
					}),
				);
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
	}),
);

const createButtonAnchorFx = Effect.fn("createButtonAnchorFx")(
	({ displayName, variant }: ButtonFactoryProps) =>
		Effect.sync(() => {
			const Component = forwardRef<HTMLAnchorElement, ButtonAnchorProps>(
				({ className, cursorIntent, onClick, ...props }, ref) => {
					const disabled =
						props["aria-disabled"] === true || props["aria-disabled"] === "true";
					const cursor = Effect.runSync(
						readControlCursorSemanticFx({
							ariaDisabled: disabled,
							intent: cursorIntent,
						}),
					);
					const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
						if (disabled) {
							event.preventDefault();
							return;
						}
						onClick?.(event);
					};
					return (
						<a
							ref={ref}
							className={twMerge(
								ButtonBaseClassName,
								ButtonVariantClassNames[variant],
								CursorClassName[cursor],
								className,
							)}
							onClick={handleClick}
							{...props}
						/>
					);
				},
			);
			Component.displayName = displayName;
			return Component;
		}),
);

/** Renders the canonical neutral game action on a native button. */
export const Button = Effect.runSync(
	createButtonFx({
		displayName: "Button",
		variant: "default",
	}),
);

/** Renders the canonical primary game action on a native button. */
export const PrimaryButton = Effect.runSync(
	createButtonFx({
		displayName: "PrimaryButton",
		variant: "primary",
	}),
);

/** Renders the canonical destructive game action on a native button. */
export const DangerButton = Effect.runSync(
	createButtonFx({
		displayName: "DangerButton",
		variant: "danger",
	}),
);

const ButtonAnchor = Effect.runSync(
	createButtonAnchorFx({
		displayName: "ButtonAnchor",
		variant: "default",
	}),
);
const PrimaryButtonAnchor = Effect.runSync(
	createButtonAnchorFx({
		displayName: "PrimaryButtonAnchor",
		variant: "primary",
	}),
);
const DangerButtonAnchor = Effect.runSync(
	createButtonAnchorFx({
		displayName: "DangerButtonAnchor",
		variant: "danger",
	}),
);

const CreatedButtonLink = createLink(ButtonAnchor);
const CreatedPrimaryButtonLink = createLink(PrimaryButtonAnchor);
const CreatedDangerButtonLink = createLink(DangerButtonAnchor);

/** Renders the canonical neutral game action with TanStack Router Link semantics. */
export const ButtonLink: LinkComponent<typeof ButtonAnchor> = (props) => (
	<CreatedButtonLink
		preload="intent"
		{...props}
	/>
);

/** Renders the canonical primary game action with TanStack Router Link semantics. */
export const PrimaryButtonLink: LinkComponent<typeof PrimaryButtonAnchor> = (props) => (
	<CreatedPrimaryButtonLink
		preload="intent"
		{...props}
	/>
);

/** Renders the canonical destructive game action with TanStack Router Link semantics. */
export const DangerButtonLink: LinkComponent<typeof DangerButtonAnchor> = (props) => (
	<CreatedDangerButtonLink
		preload="intent"
		{...props}
	/>
);
