import { z } from "zod";

export const LastPackageIdSchema = z.string().trim().min(1).meta({
	id: "LastPackageIdSchema",
	description: "The package ID of the last Game that completed renderer bootstrap successfully.",
});

export type LastPackageIdSchema = typeof LastPackageIdSchema;

export namespace LastPackageIdSchema {
	export type Type = z.infer<LastPackageIdSchema>;
}
