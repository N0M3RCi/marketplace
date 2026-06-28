import { ZodSchema } from 'zod';
import type { Request, Response, NextFunction } from 'express';

/**
 * Express middleware factory that validates `req.body` against a Zod schema.
 * On success: replaces `req.body` with the parsed (type-safe) output.
 * On failure: returns 400 with a structured error response.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields: { path: string; message: string }[] = result.error.issues.map((e: any) => ({
        path: String(e.path?.join ? e.path.join('.') : e.path ?? ''),
        message: String(e.message),
      }));
      res.status(400).json({ error: 'Validation failed', fields });
      return;
    }
    req.body = result.data;
    next();
  };
}