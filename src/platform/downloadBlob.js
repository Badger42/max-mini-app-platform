/**
 * Browser fallback for downloading a file.
 *
 * `credentials: 'same-origin'` is the safe default. Pass `include` only when
 * the download endpoint requires cross-origin cookies and its CORS policy
 * explicitly allows credentialed requests from the frontend origin.
 */
export default async function downloadBlob(
  url,
  fileName,
  { credentials = 'same-origin', revokeDelayMs = 30000 } = {}
) {
  if (!url || typeof url !== 'string') {
    throw new TypeError('A download URL is required')
  }

  if (!fileName || typeof fileName !== 'string' || !fileName.trim()) {
    throw new TypeError('A file name is required')
  }

  const response = await fetch(url, { credentials })

  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`)
  }

  if (response.type === 'opaque') {
    throw new Error('The response is opaque; check the server CORS configuration')
  }

  const blob = await response.blob()

  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  link.remove()

  // Do not revoke synchronously: some browsers need time to start the download.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), revokeDelayMs)

  return { status: 'requested' }
}
