import { createId } from "@paralleldrive/cuid2";
import { FloatingPortal } from "@floating-ui/react";
import type { LucideIcon } from "lucide-react";
import { useMemo } from "react";

import { useEditorFloatingMenu } from "~/authoring-shell/ui/useEditorFloatingMenu";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { TypePresentation } from "~/item-definition/ui/TypePresentation";
import { Button, ButtonLink, PrimaryButton } from "~/ui/ui/Button";

/** Selects an item discriminator before opening its standard explicit-save form. */
export const ItemTypeMenu = ({
	dataUi,
	defaultDraft,
	defaultItemId,
	defaultTitle,
	description,
	icon: Icon,
	itemUid,
	label,
	projectId,
	resourceId,
	triggerClassName,
	types,
	variant = "default",
}: {
	readonly dataUi: string;
	readonly defaultDraft?: boolean;
	readonly defaultItemId?: string;
	readonly defaultTitle?: string;
	readonly description: string;
	readonly icon: LucideIcon;
	readonly itemUid?: string;
	readonly label: string;
	readonly projectId: string;
	readonly resourceId?: string;
	readonly triggerClassName?: string;
	readonly types: ReadonlyArray<TypeSchema.Type>;
	readonly variant?: "default" | "primary";
}) => {
	const {
		floatingStyles,
		getFloatingProps: getFloatingPropsFn,
		getReferenceProps: getReferencePropsFn,
		open,
		refs,
	} = useEditorFloatingMenu();
	const newItemUidByType = useMemo(
		() =>
			Object.fromEntries(
				TypeSchema.options.map((type) => [
					type,
					createId(),
				]),
			) as Record<TypeSchema.Type, string>,
		[],
	);
	const Trigger = variant === "primary" ? PrimaryButton : Button;
	return (
		<>
			<Trigger
				ref={refs.setReference}
				className={triggerClassName}
				data-ui={`${dataUi}Trigger`}
				{...getReferencePropsFn()}
			>
				<Icon className="size-4" />
				{label}
			</Trigger>
			{open ? (
				<FloatingPortal>
					<div
						ref={refs.setFloating}
						style={floatingStyles}
						className="z-50 grid w-96 max-w-[calc(100vw-1rem)] gap-1 rounded-xl border border-line-strong bg-surface p-1.5 shadow-2xl"
						data-ui={dataUi}
						{...getFloatingPropsFn()}
					>
						<p className="px-2.5 py-1.5 text-xs text-muted">{description}</p>
						{types.map((type) => (
							<ButtonLink
								key={type}
								to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
								params={{
									projectId,
									itemUid: itemUid ?? newItemUidByType[type],
									sectionId: "identity",
								}}
								search={{
									...(defaultDraft === undefined
										? {}
										: {
												defaultDraft,
											}),
									...(defaultItemId === undefined
										? {}
										: {
												defaultItemId,
											}),
									...(defaultTitle === undefined
										? {}
										: {
												defaultTitle,
											}),
									itemType: type,
									...(resourceId === undefined
										? {}
										: {
												resourceId,
											}),
								}}
								className="min-h-0 justify-start gap-3 border-0 bg-transparent px-2.5 py-2 text-left shadow-none"
							>
								<TypePresentation
									describe
									type={type}
								/>
							</ButtonLink>
						))}
					</div>
				</FloatingPortal>
			) : null}
		</>
	);
};
