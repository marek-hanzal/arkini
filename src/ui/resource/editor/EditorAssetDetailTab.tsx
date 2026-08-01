import { ButtonLink } from "~/ui/button/Button";

export const EditorAssetDetailTab = ({
	filter,
	label,
	projectId,
	query,
	resourceId,
	to,
}: {
	readonly filter: "all" | "unused";
	readonly label: string;
	readonly projectId: string;
	readonly query: string;
	readonly resourceId: string;
	readonly to:
		| "/editor/$projectId/assets/$resourceId/detail/overview"
		| "/editor/$projectId/assets/$resourceId/detail/technical"
		| "/editor/$projectId/assets/$resourceId/detail/usage";
}) => (
	<ButtonLink
		to={to}
		params={{
			projectId,
			resourceId,
		}}
		search={{
			filter,
			query,
		}}
		activeOptions={{
			exact: true,
		}}
		activeProps={{
			"aria-selected": true,
			className: "border-accent bg-accent text-accent-contrast hover:bg-accent-hover",
		}}
		inactiveProps={{
			"aria-selected": false,
		}}
		className="min-h-0 rounded-b-none border-transparent bg-transparent px-4 py-2 text-sm shadow-none"
		role="tab"
	>
		{label}
	</ButtonLink>
);
