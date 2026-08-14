import { prisma } from "./prisma.js";

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "event";
}

export async function uniqueEventSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (await prisma.event.findUnique({ where: { slug } })) {
    slug = `${base}-${n}`;
    n++;
  }
  return slug;
}
