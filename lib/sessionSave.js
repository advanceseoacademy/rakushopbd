/** Call before sending login JSON (express-session). cookie-session commits on response end. */
function saveSession(req, callback) {
  if (req.session && typeof req.session.save === 'function') {
    return req.session.save(callback);
  }
  callback();
}

module.exports = { saveSession };
