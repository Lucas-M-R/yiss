// Route params are always there once the route matched, but h3 types them as optional
export function requireRouterParam(event: Parameters<typeof getRouterParam>[0], name: string): string {
  const value = getRouterParam(event, name)
  if (!value) throw createError({ statusCode: 400, message: `Paramètre manquant : ${name}` })
  return value
}
