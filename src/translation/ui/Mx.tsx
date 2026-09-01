import type { FC } from "react";

import { useTranslator } from "~/translation/ui/useTranslator";
import { Markdown, type MarkdownProps } from "~/ui/ui/Markdown";

export namespace Mx {
	export interface Props extends Omit<MarkdownProps, "children"> {
		readonly fallback?: string;
		readonly label: string | undefined;
	}
}

/** Renders one exact-key translation as application-authored Markdown. */
export const Mx: FC<Mx.Props> = ({ fallback, label, ...props }) => {
	const translator = useTranslator();
	return label === undefined ? null : (
		<Markdown {...props}>{translator.textFn(label, fallback)}</Markdown>
	);
};
