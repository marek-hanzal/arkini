import { CopyButton } from "~/ui/ui/CopyButton";

export const EditorMcpCopyableUrl = ({
	url,
	label,
}: {
	readonly url?: string;
	readonly label?: string;
}) => (
	<div className="flex w-full min-w-0 items-center justify-center gap-2 text-sm text-muted">
		<span
			className="min-w-0 truncate text-left"
			title={url}
		>
			{label === undefined ? null : `${label}: `}
			{url ?? "Configure the remote domain in the Ngrok tab."}
		</span>
		{url === undefined ? null : (
			<CopyButton
				value={url}
				title="Copy URL"
			/>
		)}
	</div>
);
