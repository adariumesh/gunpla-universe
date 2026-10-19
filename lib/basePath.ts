/** Prefix for plain <a href>/fetch URLs; <Link> and router.push add it themselves. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const withBase = (path: string) => `${BASE_PATH}${path}`;
