import type { FC } from "react";

import { useTranslator } from "~/translation/ui/useTranslator";

export namespace Tx {
	export interface Props {
		readonly fallback?: string;
		readonly label: string | undefined;
	}
}

/** Renders one exact-key plain-text translation. */
export const Tx: FC<Tx.Props> = ({ fallback, label }) => {
	const translator = useTranslator();
	return label === undefined ? null : translator.textFn(label, fallback);
};
