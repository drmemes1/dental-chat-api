module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    // Test raw fetch to OpenAI to isolate the issue
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    const data = await response.json();
    res.status(200).json({
      status: "ok",
      nodeVersion: process.version,
      hasApiKey: !!process.env.OPENAI_API_KEY,
      hasAssistantId: !!process.env.ASSISTANT_ID,
      openaiReachable: true,
      modelCount: data.data?.length || 0,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      nodeVersion: process.version,
      hasApiKey: !!process.env.OPENAI_API_KEY,
      error: error.message,
      errorType: error.constructor.name,
    });
  }
};
