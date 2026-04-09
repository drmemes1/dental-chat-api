const OpenAI = require("openai");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const thread = await openai.beta.threads.create();
    res.status(200).json({
      status: "ok",
      hasApiKey: !!process.env.OPENAI_API_KEY,
      hasAssistantId: !!process.env.ASSISTANT_ID,
      assistantId: process.env.ASSISTANT_ID,
      threadTest: thread.id,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      hasApiKey: !!process.env.OPENAI_API_KEY,
      hasAssistantId: !!process.env.ASSISTANT_ID,
      error: error.message,
      errorType: error.constructor.name,
      errorCode: error.code,
      errorStatus: error.status,
    });
  }
};
