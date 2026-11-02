import { Post, Category, Tag, PostSource } from '@/db/schema';

export interface PostWithRelations extends Post {
  category: Category | null;
  tags: Tag[];
  sources: PostSource[];
}

export interface PaginatedPostsResult {
  posts: PostWithRelations[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
