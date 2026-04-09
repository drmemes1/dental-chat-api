module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    status: "ok",
    hasApiKey: !!process.env.OPENAI_API_KEY,
    hasAssistantId: !!process.env.ASSISTANT_ID,
  });
};
