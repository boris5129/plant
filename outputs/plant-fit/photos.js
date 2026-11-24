function openPhotos() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('plant-fit-photos', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('photos')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function photoTransaction(mode, action) {
  const database = await openPhotos()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction('photos', mode)
      const request = action(transaction.objectStore('photos'))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    database.close()
  }
}

export const readPhoto = (id) => photoTransaction('readonly', (store) => store.get(id))
export const deletePhoto = (id) => photoTransaction('readwrite', (store) => store.delete(id))

export async function savePhoto(id, file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
    throw new Error('12MB 이하의 JPG, PNG 또는 WebP 사진을 선택하세요.')
  }
  const image = await createImageBitmap(file).catch(() => {
    throw new Error('사진을 열 수 없습니다. 이미지 파일을 확인하세요.')
  })
  let blob
  try {
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', .86))
    if (!blob) throw new Error('사진을 저장용 이미지로 변환할 수 없습니다.')
  } finally {
    image.close()
  }
  await photoTransaction('readwrite', (store) => store.put(blob, id))
}
