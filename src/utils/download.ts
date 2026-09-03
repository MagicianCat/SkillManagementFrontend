import type { AxiosResponse } from 'axios'

function decodeFilename(value: string) {
  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const plain = value.match(/filename="?([^";]+)"?/i)?.[1]
  const candidate = encoded ? decodeURIComponent(encoded) : plain
  return (candidate || 'skill-download.zip').replace(/[\\/]/g, '_')
}

export function saveBlobResponse(response: AxiosResponse<Blob>) {
  const disposition = response.headers['content-disposition'] as
    string | undefined
  const filename = disposition
    ? decodeFilename(disposition)
    : 'skill-download.zip'
  const url = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
