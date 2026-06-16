export interface Photo {
  id: string;
  url: string;
  thumbnailUrl: string;
  title: string;
  description: string;
  location: string;
  userId: string;
  userName: string;
  uploadedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  photoCount: number;
  joinedAt: string;
  isAdmin: boolean;
}

export interface AdminStats {
  totalUsers: number;
  totalPhotos: number;
  totalLocations: number;
  topLocations: Array<{ name: string; count: number }>;
}
