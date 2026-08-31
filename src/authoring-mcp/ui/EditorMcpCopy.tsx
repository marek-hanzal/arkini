import { Check, Copy } from "lucide-react";

export const EditorMcpCopyButton = ({
	copied,
	onCopy,
	title,
}: {
	readonly copied: boolean;
	readonly onCopy: () => void;
	readonly title: string;
}) => {
	const Icon = copied ? Check : Copy;
	return (
		<button
			type="button"
			className="grid size-6 shrink-0 cursor-pointer place-items-center border-0 bg-transparent p-0 text-current opacity-65 transition-opacity hover:opacity-100"
			title={copied ? "Copied" : title}
			onClick={onCopy}
		>
			<Icon className="size-4" />
		</button>
	);
};

export const EditorMcpCopyableUrl = ({
	copied,
	label,
	onCopy,
	url,
}: {
	readonly copied: boolean;
	readonly label: string;
	readonly onCopy: () => void;
	readonly url: string;
}) => (
	<div className="flex min-w-0 items-center gap-1 text-sm text-success">
		<span className="min-w-0 break-all">
			{label}: {url}
		</span>
		<EditorMcpCopyButton
			copied={copied}
			onCopy={onCopy}
			title="Copy URL"
		/>
	</div>
);
