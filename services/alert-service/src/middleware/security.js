const helmet = require('helmet');

const helmetMiddleware = helmet({
  contentSecurityPolicy: false, // API-only service
});

const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
};

module.exports = { helmetMiddleware, securityHeaders };
