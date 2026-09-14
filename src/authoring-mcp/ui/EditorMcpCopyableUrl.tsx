import { useTranslator } from "~/translation/ui/useTranslator";
import { CopyButton } from "~/ui/ui/CopyButton";

export const EditorMcpCopyableUrl = ({
	url,
	label,
}: {
	readonly url?: string;
	readonly label?: string;
}) => {
	const translator = useTranslator();
	return (
		<div className="flex w-full min-w-0 items-center justify-center gap-2 text-sm text-muted">
			<span
				className="min-w-0 truncate text-left"
				title={url}
			>
				{label === undefined ? null : `${label}: `}
				{url ?? translator.textFn("Configure the remote domain in the ngrok tab.")}
			</span>
			{url === undefined ? null : (
				<CopyButton
					value={url}
					title={translator.textFn("Copy URL")}
				/>
			)}
		</div>
	);
};
