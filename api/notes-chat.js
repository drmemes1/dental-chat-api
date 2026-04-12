const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, CORS_HEADERS);
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  try {
    const { model, messages, max_tokens, temperature } = req.body;

    if (!messages || !messages.length) {
      res.status(400).json({ error: "Messages are required" });
      return;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "gpt-4o",
        messages,
        max_tokens: max_tokens || 1000,
        temperature: temperature ?? 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI: ${response.status} ${err}`);
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error("Notes chat error:", error);
    res.status(500).json({
      choices: [{ message: { content: "Error generating note. Please try again." } }],
      error: error.message,
    });
  }
};
