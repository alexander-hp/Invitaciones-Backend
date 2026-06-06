const { z } = require('zod');

function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!result.success) {
      const error = new Error('Datos invalidos');
      error.statusCode = 400;
      error.details = result.error.flatten();
      return next(error);
    }
    req.validated = result.data;
    next();
  };
}

const idParam = z.object({ params: z.object({ id: z.string().min(12) }) });

module.exports = { validate, idParam, z };
