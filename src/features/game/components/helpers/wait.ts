export async function wait(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}
