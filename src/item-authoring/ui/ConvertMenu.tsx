import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { FloatingPortal } from "@floating-ui/react";
import { Replace } from "lucide-react";
import { Button, ButtonLink } from "~/ui/ui/Button";
import { useEditorFloatingMenu } from "~/authoring-shell/ui/useEditorFloatingMenu";
import { editorSectionTabClassName } from "~/authoring-shell/ui/EditorSectionTabs";
import { TypePresentation } from "~/item-authoring/ui/TypePresentation";

/** Selects a target discriminator before opening the standard explicit-save item form. */
export const ConvertMenu = ({
	itemType,
	itemUid,
	projectId,
}: {
	readonly itemType: TypeSchema.Type;
	readonly itemUid: string;
	readonly projectId: string;
}) => {
	const {
		floatingStyles,
		getFloatingProps: getFloatingPropsFn,
		getReferenceProps: getReferencePropsFn,
		open,
		refs,
	} = useEditorFloatingMenu();
	return (
		<>
			<Button
				ref={refs.setReference}
				className={`${editorSectionTabClassName} h-10 min-h-10 gap-2`}
				{...getReferencePropsFn()}
			>
				<Replace className="size-4" />
				Convert
			</Button>
			{open ? (
				<FloatingPortal>
					<div
						ref={refs.setFloating}
						style={floatingStyles}
						className="z-50 grid w-96 max-w-[calc(100vw-1rem)] gap-1 rounded-xl border border-line-strong bg-surface p-1.5 shadow-2xl"
						data-ui="EditorItemConvertMenu"
						{...getFloatingPropsFn()}
					>
						<p className="px-2.5 py-1.5 text-xs text-muted">
							Compatible data is kept; unsupported fields are removed on Save.
						</p>
						{TypeSchema.options
							.filter((type) => type !== itemType)
							.map((type) => {
								const presentation = TypePresentation[type];
								const Icon = presentation.icon;
								return (
									<ButtonLink
										key={type}
										to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
										params={{
											projectId,
											itemUid,
											sectionId: "identity",
										}}
										search={{
											itemType: type,
										}}
										className="min-h-0 justify-start gap-3 border-0 bg-transparent px-2.5 py-2 text-left shadow-none"
									>
										<Icon className="size-6 shrink-0 text-accent" />
										<span className="min-w-0">
											<span className="block font-semibold capitalize">
												{type}
											</span>
											<span className="mt-0.5 block text-xs font-normal leading-4 text-muted">
												{presentation.description}
											</span>
										</span>
									</ButtonLink>
								);
							})}
					</div>
				</FloatingPortal>
			) : null}
		</>
	);
};
