function notFound(req, _res, next) {
  const error = new Error(`Ruta no encontrada: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, _req, res, _next) {
  let statusCode = error.statusCode;
  if (!statusCode && (error.name === 'ValidationError' || error.name === 'CastError')) {
    statusCode = 400;
  }
  statusCode = statusCode || 500;
  if (statusCode === 400 && error.details) {
    console.error('Validation Error Details:', JSON.stringify(error.details, null, 2));
  }
  let message = error.message || 'Error interno';
  if (error.name === 'ValidationError' && error.errors) {
    const errorKeys = Object.keys(error.errors);
    if (errorKeys.length > 0) {
      const messages = errorKeys.map((k) => error.errors[k]?.message || `${k} es inválido`).filter(Boolean);
      if (messages.length > 0) {
        message = messages.join('. ');
      }
    }
  }
  res.status(statusCode).json({
    message,
    details: error.details || undefined
  });
}

module.exports = { notFound, errorHandler };
