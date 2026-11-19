import { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

export function validateBody<S extends z.ZodType>(schema: S): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const flattened = z.flattenError(result.error);
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Os dados enviados são inválidos.',
        fields: flattened.fieldErrors,
        formErrors: flattened.formErrors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
