function notFound(req, _res, next) {
  const error = new Error(`Ruta no encontrada: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    message: error.message || 'Error interno',
    details: error.details || undefined
  });
}

module.exports = { notFound, errorHandler };
