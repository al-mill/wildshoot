import type { User, AdminStats } from '~/types';

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const MOCK_USERS: User[] = [
  {
    id: '1',
    name: 'Alex Miller',
    email: 'alex@example.com',
    photoCount: 1,
    joinedAt: '2024-03-01T00:00:00Z',
    isAdmin: true,
  },
  {
    id: '2',
    name: 'Jordan Chen',
    email: 'jordan@example.com',
    photoCount: 2,
    joinedAt: '2024-03-15T00:00:00Z',
    isAdmin: false,
  },
  {
    id: '3',
    name: 'Sam Rivera',
    email: 'sam@example.com',
    photoCount: 2,
    joinedAt: '2024-04-01T00:00:00Z',
    isAdmin: false,
  },
  {
    id: '4',
    name: 'Taylor Kim',
    email: 'taylor@example.com',
    photoCount: 1,
    joinedAt: '2024-04-20T00:00:00Z',
    isAdmin: false,
  },
];

const MOCK_STATS: AdminStats = {
  totalUsers: 4,
  totalPhotos: 6,
  totalLocations: 6,
  topLocations: [
    { name: 'San Francisco, CA', count: 2 },
    { name: 'Rocky Mountain National Park, CO', count: 1 },
    { name: 'Chicago, IL', count: 1 },
    { name: 'Joshua Tree, CA', count: 1 },
    { name: 'Stowe, VT', count: 1 },
  ],
};

export const useAdminStore = defineStore('admin', () => {
  const stats = ref<AdminStats | null>(null);
  const users = ref<User[]>([]);
  const isLoading = ref(false);

  async function fetchStats() {
    isLoading.value = true;
    await wait(400); // TODO: GET /api/admin/stats
    stats.value = { ...MOCK_STATS };
    isLoading.value = false;
  }

  async function fetchUsers() {
    isLoading.value = true;
    await wait(400); // TODO: GET /api/admin/users
    users.value = [...MOCK_USERS];
    isLoading.value = false;
  }

  return { stats, users, isLoading, fetchStats, fetchUsers };
});
