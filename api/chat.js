const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

module.exports = async function handler(req, res) {
  // Handle CORS preflight
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

  // Set CORS headers for all responses
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  try {
    const { message, threadId } = req.body;

    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    // Create or reuse thread
    const thread = threadId
      ? { id: threadId }
      : await openai.beta.threads.create();

    // Add message to thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message,
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    if (run.status !== "completed") {
      throw new Error(`Run ended with status: ${run.status}`);
    }

    // Get the assistant's response
    const messages = await openai.beta.threads.messages.list(thread.id, {
      order: "desc",
      limit: 1,
    });

    const assistantMessage = messages.data[0];
    const responseText =
      assistantMessage?.content?.[0]?.type === "text"
        ? assistantMessage.content[0].text.value
        : "I'm sorry, I couldn't process that. Please call us at (718) 339-8852.";

    res.status(200).json({
      response: responseText,
      threadId: thread.id,
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({
      response:
        "I'm sorry, something went wrong. Please call us at (718) 339-8852.",
      error: error.message,
    });
  }
};
