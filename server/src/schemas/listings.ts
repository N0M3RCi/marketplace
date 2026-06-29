import { z } from 'zod';

export const createListing = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(50000).default(''),
  price: z.number().positive('Price must be positive').finite(),
  currency: z.string().max(10).default('USD'),
  categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
  images: z.array(z.string()).max(20).default([]),
  condition: z.enum(['new', 'like-new', 'good', 'fair', 'poor']).default('good'),
  location: z.string().max(200).default(''),
  sellerId: z.string().uuid().optional().nullable(),
});

export const updateListing = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(50000).optional(),
  price: z.number().positive().finite().optional(),
  currency: z.string().max(10).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  images: z.array(z.string()).max(20).optional(),
  condition: z.enum(['new', 'like-new', 'good', 'fair', 'poor']).optional(),
  location: z.string().max(200).optional(),
  status: z.enum(['active', 'inactive', 'sold']).optional(),
});