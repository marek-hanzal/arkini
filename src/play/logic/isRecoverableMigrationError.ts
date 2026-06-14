export const isRecoverableMigrationError = (error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	return (
		message.includes("corrupted migrations") ||
		message.includes("previously executed migration") ||
		message.includes("is missing")
	);
};
