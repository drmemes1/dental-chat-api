const fs = require("fs");
const path = require("path");

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
    const promptPath = path.join(process.cwd(), "public", "quentin-bot-prompt.md");
    console.log("Prompt path:", promptPath);
    console.log("File exists:", fs.existsSync(promptPath));

    const systemPrompt = fs.readFileSync(promptPath, "utf8");
    console.log("Prompt length:", systemPrompt.length);
    console.log("Prompt preview:", systemPrompt.substring(0, 100));

    const { messages } = req.body;
    console.log("Messages received:", JSON.stringify(messages));

    if (!messages || !messages.length) {
      res.status(400).json({ error: "Messages are required" });
      return;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", response.status, err);
      throw new Error(`Anthropic API: ${response.status} ${err}`);
    }

    const data = await response.json();
    console.log("Anthropic response:", JSON.stringify(data).substring(0, 200));

    const responseText =
      data.content?.[0]?.text ||
      "I'm sorry, I couldn't process that. Please call us at (718) 339-8852.";

    res.status(200).json({ response: responseText });
  } catch (error) {
    console.error("Chat error:", error.message);
    console.error("Stack:", error.stack);
    res.status(500).json({
      response:
        "I'm sorry, something went wrong. Please call us at (718) 339-8852.",
      error: error.message,
    });
  }
};
