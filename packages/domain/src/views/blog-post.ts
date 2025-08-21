import type { BlogPost } from "../models/blog-post";
import type { UserMinimal } from "../models/user";

export type BlogPostWithUser = BlogPost & {
  user: UserMinimal;
  coverImage?: string;
  imageUrls?: string[];
};

export type BlogPostWithFiles = BlogPost & {
  coverImage?: string;
  imageUrls: string[];
};
