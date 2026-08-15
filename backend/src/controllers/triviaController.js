const Trivia = require('../models/Trivia');

// @desc    The current "trivia of the day" card - the most recently created active item.
//          Correct answer/explanation are deliberately withheld until the requesting user has
//          actually answered (or was never asked to guess) - shipping `correctIndex` to an
//          unauthenticated or not-yet-answered viewer would let anyone read it straight off the
//          network response, defeating the point of a quiz card. If this user has already
//          answered (checked against `answeredBy`, never a client-supplied flag), the response
//          includes their prior answer/correctness so the frontend shows the revealed state
//          instead of re-prompting.
// @route   GET /api/trivia/current
// @access  Public (optionalAuth - reveals prior answer only when the request is authenticated)
exports.getCurrentTrivia = async (req, res) => {
  try {
    const trivia = await Trivia.findOne({ isActive: true }).sort({ createdAt: -1 });
    if (!trivia) {
      return res.status(200).json({ success: true, trivia: null });
    }

    let myAnswer = null;
    if (req.user) {
      const mine = trivia.answeredBy.find((a) => a.user.toString() === req.user.id);
      if (mine) {
        myAnswer = { optionIndex: mine.optionIndex, correct: mine.optionIndex === trivia.correctIndex };
      }
    }
    const revealed = Boolean(myAnswer);

    res.status(200).json({
      success: true,
      trivia: {
        _id: trivia._id,
        question: trivia.question,
        options: trivia.options,
        createdAt: trivia.createdAt,
        correctIndex: revealed ? trivia.correctIndex : null,
        explanation: revealed ? trivia.explanation : null,
        myAnswer
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Answer the trivia question - once per user, enforced against `answeredBy` server-side
//          (never trusts a client-supplied "have I answered" flag). Immediately reveals
//          correctness + the explanation, same as the frontend needs for the reveal state.
// @route   POST /api/trivia/:id/answer
// @access  Private
exports.answerTrivia = async (req, res) => {
  try {
    const { optionIndex } = req.body;
    const trivia = await Trivia.findById(req.params.id);
    if (!trivia) {
      return res.status(404).json({ success: false, message: 'Trivia not found' });
    }
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= trivia.options.length) {
      return res.status(400).json({ success: false, message: 'Invalid optionIndex' });
    }

    const alreadyAnswered = trivia.answeredBy.some((a) => a.user.toString() === req.user.id);
    if (alreadyAnswered) {
      return res.status(400).json({ success: false, message: 'You have already answered this trivia question' });
    }

    trivia.answeredBy.push({ user: req.user.id, optionIndex, answeredAt: new Date() });
    await trivia.save();

    res.status(200).json({
      success: true,
      correct: optionIndex === trivia.correctIndex,
      correctIndex: trivia.correctIndex,
      explanation: trivia.explanation
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
