import type { PropsWithChildren } from "react";

import { EditorEditItemForm } from "~/ui/item/editor/EditorEditItemForm";

export const EditorItemEditPage = ({
	children,
	uid,
}: PropsWithChildren<{ readonly uid: string }>) => (
	<EditorEditItemForm uid={uid}>{children}</EditorEditItemForm>
);
