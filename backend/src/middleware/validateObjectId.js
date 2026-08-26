const mongoose = require('mongoose');

// Rejects a malformed :id-style route param with 400 before it reaches a controller.
//
// Without this every detail route answers a bad id with HTTP 500 and the raw Mongoose message:
//
//   GET /api/players/not-an-id
//   500 {"message":"Cast to ObjectId failed for value \"not-an-id\" ... for model \"Player\""}
//
// Two things wrong with that. A malformed id is a CLIENT error, so 500 is the wrong class and
// makes real server faults impossible to find in monitoring - every crawler and stale deep link
// looks like an outage. And the body discloses the ODM, the model name and the internal field
// path, which is free reconnaissance for no benefit.
//
// Applied via router.param, so it runs for any route in that router carrying the named param -
// there is no per-route wiring to forget when a route is added later.
const ID_PARAMS = [
  'id', 'playerId', 'userId', 'matchId', 'teamId', 'tournamentId',
  'documentId', 'bowlerId', 'batsmanId', 'photoId', 'messageId'
];

function validateObjectIdParams(router, names = ID_PARAMS) {
  for (const name of names) {
    router.param(name, (req, res, next, value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${name}: not a valid id.`
        });
      }
      next();
    });
  }
  return router;
}

module.exports = { validateObjectIdParams, ID_PARAMS };
