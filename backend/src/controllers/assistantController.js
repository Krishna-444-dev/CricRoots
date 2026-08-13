const { askAssistant, isConfigured, MAX_MESSAGE_LENGTH } = require('../services/assistantService');

// @desc    Lets the frontend check whether to show the chat widget at all vs. a
//          "coming soon" state, without needing to fire a real (billed) message first.
// @route   GET /api/assistant/status
// @access  Private
exports.getStatus = async (req, res) => {
  res.status(200).json({ success: true, configured: isConfigured() });
};

// @desc    Ask the in-app assistant a question (app help or cricket rules, optionally
//          grounded in a specific tournament's house rules).
// @route   POST /api/assistant/ask
// @access  Private
exports.ask = async (req, res) => {
  try {
    const { message, history, tournamentId } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'message is required' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ success: false, message: `message must be under ${MAX_MESSAGE_LENGTH} characters` });
    }

    const result = await askAssistant({ message, history, tournamentId });

    res.status(200).json({
      success: true,
      configured: result.configured,
      reply: result.reply
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
