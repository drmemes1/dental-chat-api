const OPENAI_BASE = "https://api.openai.com/v1";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function headers() {
  return {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
    "OpenAI-Beta": "assistants=v2",
  };
}

async function openaiRequest(method, path, body) {
  const res = await fetch(`${OPENAI_BASE}${path}`, {
    method,
    headers: headers(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${path}: ${res.status} ${err}`);
  }
  return res.json();
}

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
    const { message, threadId, systemPrompt } = req.body;

    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    // Create or reuse thread
    const thread = threadId
      ? { id: threadId }
      : await openaiRequest("POST", "/threads", {});

    // Add message to thread
    await openaiRequest("POST", `/threads/${thread.id}/messages`, {
      role: "user",
      content: message,
    });

    // Create a run — pass instructions to override assistant's stored prompt
    const runBody = { assistant_id: process.env.ASSISTANT_ID };
    if (systemPrompt && systemPrompt.trim()) {
      runBody.instructions = systemPrompt;
    }
    const run = await openaiRequest("POST", `/threads/${thread.id}/runs`, runBody);

    // Poll until complete
    let status = run.status;
    let runData = run;
    while (status === "queued" || status === "in_progress") {
      await new Promise((r) => setTimeout(r, 1000));
      runData = await openaiRequest(
        "GET",
        `/threads/${thread.id}/runs/${run.id}`
      );
      status = runData.status;
    }

    if (status !== "completed") {
      throw new Error(`Run ended with status: ${status}`);
    }

    // Get messages
    const messages = await openaiRequest(
      "GET",
      `/threads/${thread.id}/messages?order=desc&limit=1`
    );

    const assistantMessage = messages.data?.[0];
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
