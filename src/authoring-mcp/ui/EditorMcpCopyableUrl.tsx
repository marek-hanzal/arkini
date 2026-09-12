import { CopyButton } from "~/ui/ui/CopyButton";

export const EditorMcpCopyableUrl = ({
	label,
	url,
}: {
	readonly label: string;
	readonly url: string;
}) => (
	<div className="flex min-w-0 items-center gap-1 text-sm text-success">
		<span className="min-w-0 break-all">
			{label}: {url}
		</span>
		<CopyButton
			value={url}
			title="Copy URL"
		/>
	</div>
);
