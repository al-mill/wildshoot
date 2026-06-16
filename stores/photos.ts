import type { Photo } from '~/types'

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

const MOCK_PHOTOS: Photo[] = [
  {
    id: '1',
    url: 'https://picsum.photos/seed/ws1/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/ws1/400/300',
    title: 'Mountain Sunrise',
    description: 'Early morning hike to catch the golden hour',
    location: 'Rocky Mountain National Park, CO',
    userId: '2',
    userName: 'Jordan Chen',
    uploadedAt: '2024-05-10T06:30:00Z',
  },
  {
    id: '2',
    url: 'https://picsum.photos/seed/ws2/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/ws2/400/300',
    title: 'City at Dusk',
    description: 'Downtown lights just after sunset',
    location: 'Chicago, IL',
    userId: '3',
    userName: 'Sam Rivera',
    uploadedAt: '2024-05-11T20:15:00Z',
  },
  {
    id: '3',
    url: 'https://picsum.photos/seed/ws3/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/ws3/400/300',
    title: 'Desert Road',
    description: '',
    location: 'Joshua Tree, CA',
    userId: '4',
    userName: 'Taylor Kim',
    uploadedAt: '2024-05-12T14:00:00Z',
  },
  {
    id: '4',
    url: 'https://picsum.photos/seed/ws4/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/ws4/400/300',
    title: 'Forest Path',
    description: 'A quiet walk through old-growth trees',
    location: 'Olympic National Forest, WA',
    userId: '2',
    userName: 'Jordan Chen',
    uploadedAt: '2024-05-13T09:45:00Z',
  },
  {
    id: '5',
    url: 'https://picsum.photos/seed/ws5/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/ws5/400/300',
    title: 'Coastal Fog',
    description: 'Morning fog rolling over the bay',
    location: 'San Francisco, CA',
    userId: '1',
    userName: 'Alex Miller',
    uploadedAt: '2024-05-14T07:00:00Z',
  },
  {
    id: '6',
    url: 'https://picsum.photos/seed/ws6/800/600',
    thumbnailUrl: 'https://picsum.photos/seed/ws6/400/300',
    title: 'Autumn Colors',
    description: 'Peak foliage in the valley',
    location: 'Stowe, VT',
    userId: '3',
    userName: 'Sam Rivera',
    uploadedAt: '2024-05-14T11:30:00Z',
  },
]

export const usePhotosStore = defineStore('photos', () => {
  const photos = ref<Photo[]>([])
  const isLoading = ref(false)

  async function fetchPhotos() {
    isLoading.value = true
    await wait(400) // TODO: GET /api/photos
    photos.value = [...MOCK_PHOTOS]
    isLoading.value = false
  }

  async function uploadPhoto(
    file: File,
    location: string,
    description: string
  ): Promise<Photo> {
    isLoading.value = true
    await wait(800) // TODO: POST /api/photos (multipart)
    const photo: Photo = {
      id: String(Date.now()),
      url: URL.createObjectURL(file),
      thumbnailUrl: URL.createObjectURL(file),
      title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      description,
      location,
      userId: '1',
      userName: 'Alex Miller',
      uploadedAt: new Date().toISOString(),
    }
    photos.value.unshift(photo)
    isLoading.value = false
    return photo
  }

  async function deletePhoto(id: string) {
    await wait(300) // TODO: DELETE /api/photos/:id
    photos.value = photos.value.filter(p => p.id !== id)
  }

  return { photos, isLoading, fetchPhotos, uploadPhoto, deletePhoto }
})
