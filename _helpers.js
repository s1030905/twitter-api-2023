
function getUser (req) {
  return req.user
}

// use helpers.getUser(req) to replace req.user

// function authenticated (req, res, next) {
//   // passport.authenticate('jwt', { ses...
//   authenticated
// }

const ensureAuthenticated = req => {
  return req.isAuthenticated()
}

module.exports = { getUser, ensureAuthenticated }
