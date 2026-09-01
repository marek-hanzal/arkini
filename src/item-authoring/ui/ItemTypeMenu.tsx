import { FloatingPortal } from "@floating-ui/react";
import type { LucideIcon } from "lucide-react";

import { useEditorFloatingMenu } from "~/authoring-shell/ui/useEditorFloatingMenu";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { TypePresentation } from "~/item-definition/ui/TypePresentation";
import { Button, ButtonLink, PrimaryButton } from "~/ui/ui/Button";

/** Selects an item discriminator before opening its standard explicit-save form. */
export const ItemTypeMenu = ({
	dataUi,
	description,
	icon: Icon,
	label,
	projectId,
	readItemUidFn,
	triggerClassName,
	types,
	variant = "default",
}: {
	readonly dataUi: string;
	readonly description: string;
	readonly icon: LucideIcon;
	readonly label: string;
	readonly projectId: string;
	readonly readItemUidFn: (type: TypeSchema.Type) => string;
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
									itemUid: readItemUidFn(type),
									sectionId: "identity",
								}}
								search={{
									itemType: type,
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
