import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { createContext, useContext, type PropsWithChildren } from "react";
import type { useFormController } from "~/item-authoring/ui/useFormController";

type FormSession = useFormController.Output & {
	readonly isNew: boolean;
	readonly itemType?: TypeSchema.Type;
	readonly productionLineId?: string;
};

const FormContext = createContext<FormSession | undefined>(undefined);

export const FormProvider = ({
	children,
	value,
}: PropsWithChildren<{
	readonly value: FormSession;
}>) => <FormContext value={value}>{children}</FormContext>;

/** Reads the exact local item form session owned by the item form parent route. */
export const useFormSession = () => {
	const session = useContext(FormContext);
	if (session === undefined) {
		throw new Error("Item section routes require FormProvider.");
	}
	return session;
};
