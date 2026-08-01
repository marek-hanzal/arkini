import type { EditorItemType } from "~/bridge/item/editor/EditorItemModel";
import { ButtonLink } from "~/ui/button/Button";
import type { EditorItemSectionDescriptor } from "~/ui/item/editor/EditorItemSections";

const className =
	"min-h-0 rounded-b-none border-transparent bg-transparent px-3 py-2 text-sm shadow-none hover:bg-surface-raised";
const activeProps = {
	"aria-selected": true,
	className: "border-accent bg-accent text-accent-contrast hover:bg-accent-hover",
} as const;
const inactiveProps = {
	"aria-selected": false,
} as const;

interface CommonProps {
	readonly itemUid: string;
	readonly projectId: string;
	readonly section: EditorItemSectionDescriptor;
}

const EditorCreateItemSectionLink = ({
	itemType,
	itemUid,
	projectId,
	section,
}: CommonProps & { readonly itemType: EditorItemType }) => {
	const props = {
		activeProps,
		inactiveProps,
		className,
		params: { projectId, itemUid },
		role: "tab",
		search: { itemType },
	} as const;
	switch (section.id) {
		case "identity":
			return (
				<ButtonLink
					{...props}
					to="/editor/$projectId/editor/items/$itemUid/create/identity"
				>
					{section.label}
				</ButtonLink>
			);
		case "artwork":
			return (
				<ButtonLink
					{...props}
					to="/editor/$projectId/editor/items/$itemUid/create/artwork"
				>
					{section.label}
				</ButtonLink>
			);
		case "limits":
			return (
				<ButtonLink
					{...props}
					to="/editor/$projectId/editor/items/$itemUid/create/limits"
				>
					{section.label}
				</ButtonLink>
			);
		case "charges":
			return (
				<ButtonLink
					{...props}
					to="/editor/$projectId/editor/items/$itemUid/create/charges"
				>
					{section.label}
				</ButtonLink>
			);
		case "merges":
			return (
				<ButtonLink
					{...props}
					to="/editor/$projectId/editor/items/$itemUid/create/merges"
				>
					{section.label}
				</ButtonLink>
			);
		case "production":
			return (
				<ButtonLink
					{...props}
					to="/editor/$projectId/editor/items/$itemUid/create/production"
				>
					{section.label}
				</ButtonLink>
			);
	}
};

const EditorEditItemSectionLink = ({ itemUid, projectId, section }: CommonProps) => {
	const props = {
		activeProps,
		inactiveProps,
		className,
		params: { projectId, itemUid },
		role: "tab",
	} as const;
	switch (section.id) {
		case "identity":
			return (
				<ButtonLink
					{...props}
					to="/editor/$projectId/editor/items/$itemUid/edit/identity"
				>
					{section.label}
				</ButtonLink>
			);
		case "artwork":
			return (
				<ButtonLink
					{...props}
					to="/editor/$projectId/editor/items/$itemUid/edit/artwork"
				>
					{section.label}
				</ButtonLink>
			);
		case "limits":
			return (
				<ButtonLink
					{...props}
					to="/editor/$projectId/editor/items/$itemUid/edit/limits"
				>
					{section.label}
				</ButtonLink>
			);
		case "charges":
			return (
				<ButtonLink
					{...props}
					to="/editor/$projectId/editor/items/$itemUid/edit/charges"
				>
					{section.label}
				</ButtonLink>
			);
		case "merges":
			return (
				<ButtonLink
					{...props}
					to="/editor/$projectId/editor/items/$itemUid/edit/merges"
				>
					{section.label}
				</ButtonLink>
			);
		case "production":
			return (
				<ButtonLink
					{...props}
					to="/editor/$projectId/editor/items/$itemUid/edit/production"
				>
					{section.label}
				</ButtonLink>
			);
	}
};

export const EditorItemSectionLink = ({
	itemUid,
	projectId,
	route,
	section,
}: CommonProps & {
	readonly route:
		| { readonly kind: "create"; readonly itemType: EditorItemType }
		| { readonly kind: "edit" };
}) =>
	route.kind === "create" ? (
		<EditorCreateItemSectionLink
			itemType={route.itemType}
			itemUid={itemUid}
			projectId={projectId}
			section={section}
		/>
	) : (
		<EditorEditItemSectionLink
			itemUid={itemUid}
			projectId={projectId}
			section={section}
		/>
	);
