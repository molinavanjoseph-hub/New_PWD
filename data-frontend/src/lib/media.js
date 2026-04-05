export const mediaUrl = (path) => {
  const normalizedPath = String(path || '').trim()

  if (!normalizedPath) return ''
  if (/^(https?:\/\/|data:|blob:)/i.test(normalizedPath)) return normalizedPath

  return normalizedPath.startsWith('/')
    ? normalizedPath
    : `/${normalizedPath.replace(/^\/+/, '')}`
}
