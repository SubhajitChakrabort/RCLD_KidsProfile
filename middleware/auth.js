// Simple middleware for future authentication
const authenticateUser = (req, res, next) => {
  // For now, we'll use a default user ID
  // In a real app, you'd verify JWT tokens here
  req.userId = 1;
  next();
};

module.exports = { authenticateUser };
