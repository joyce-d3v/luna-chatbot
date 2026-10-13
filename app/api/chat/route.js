import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const LUNA_INSTRUCTIONS = `
You are LUNA, a helpful general-purpose AI assistant.

Your personality:
- Be warm, natural, and conversational.
- Sound human, not robotic or overly formal.
- Be friendly without being excessively enthusiastic.
- Do not constantly say things like "Great question!" or "Absolutely!".
- Do not introduce yourself unless it is relevant to the conversation.
- Match the user's tone naturally.
- Never pretend to have personal experiences, feelings, memories, or abilities that you do not actually have.

How you should answer:
- Understand what the user is actually asking before responding.
- Give the direct answer first when possible.
- Keep simple answers reasonably short.
- Give more detail when the question genuinely requires it.
- Break complicated ideas into clear steps.
- Use examples when they make an explanation easier to understand.
- Use Markdown formatting when it improves readability.
- For code, provide clean, properly formatted code and explain important parts when useful.
- If you are unsure about something, say so rather than confidently making something up.
- If a question is ambiguous, ask a concise clarifying question when necessary.
- Do not repeat the user's question unnecessarily.

When users upload files or images:
- Carefully examine the provided file or image.
- Answer questions about its actual contents.
- For study notes, help explain concepts, summarize material, and generate practice questions when requested.
- For documents, identify important information and explain it clearly.
- For images, describe relevant visible details and help interpret diagrams, charts, and screenshots.
- Never claim to have read or examined a file if its contents were not provided or could not be processed.
- If the requested information is not present in the file, say so.

You can help with:
- General questions
- Learning and studying
- Writing and editing
- Brainstorming
- Programming and debugging
- Mathematics and science
- Research and explanations
- Planning and organization
- Creative ideas

Your goal is to be genuinely useful while keeping the conversation natural.
`;

const MAX_FILE_SIZE = 3 * 1024 * 1024;

const ALLOWED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

const TEXT_FILE_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
]);

export async function POST(request) {
  try {
    const {
      message,
      attachment,
      previousInteractionId,
    } = await request.json();

    const userMessage =
      typeof message === "string" ? message.trim() : "";

    if (!userMessage && !attachment) {
      return Response.json(
        { error: "Enter a message or attach a file." },
        { status: 400 }
      );
    }

    let input;

    if (attachment) {
      if (
        typeof attachment.name !== "string" ||
        typeof attachment.mimeType !== "string" ||
        typeof attachment.data !== "string"
      ) {
        return Response.json(
          { error: "The uploaded file could not be processed." },
          { status: 400 }
        );
      }

      if (!ALLOWED_FILE_TYPES.has(attachment.mimeType)) {
        return Response.json(
          {
            error:
              "This file type is not supported. Upload a JPG, PNG, GIF, WebP, PDF, TXT, Markdown, or CSV file.",
          },
          { status: 415 }
        );
      }

      // Decode the Base64 data to validate the actual file size.
      const fileBuffer = Buffer.from(attachment.data, "base64");

      if (
        fileBuffer.length === 0 ||
        fileBuffer.length > MAX_FILE_SIZE
      ) {
        return Response.json(
          {
            error: "Files must be smaller than or equal to 3 MB.",
          },
          { status: 413 }
        );
      }

      // Reject malformed Base64 rather than passing corrupted data on.
      const normalizedBase64 = fileBuffer.toString("base64");

      if (normalizedBase64 !== attachment.data) {
        return Response.json(
          { error: "The uploaded file data is invalid." },
          { status: 400 }
        );
      }

      const prompt =
        userMessage ||
        `Please examine the attached file "${attachment.name}" and explain its contents.`;

      if (TEXT_FILE_TYPES.has(attachment.mimeType)) {
        const fileText = fileBuffer.toString("utf8");

        input = [
          {
            type: "text",
            text: `${prompt}\n\nThe user attached a text file named "${attachment.name}". Its contents are provided below:\n\n--- FILE CONTENTS START ---\n${fileText}\n--- FILE CONTENTS END ---`,
          },
        ];
      } else {
        const contentType = attachment.mimeType.startsWith("image/")
          ? "image"
          : "document";

        input = [
          {
            type: "text",
            text: prompt,
          },
          {
            type: contentType,
            data: normalizedBase64,
            mime_type: attachment.mimeType,
          },
        ];
      }
    } else {
      input = userMessage;
    }

    const interaction = await ai.interactions.create({
      model: "gemini-3.5-flash-lite",
      input,
      system_instruction: LUNA_INSTRUCTIONS,
      ...(previousInteractionId
        ? {
            previous_interaction_id: previousInteractionId,
          }
        : {}),
    });

    return Response.json({
      reply:
        interaction.output_text ||
        "I couldn't generate a response. Please try again.",
      interactionId: interaction.id,
    });
  } catch (error) {
    console.error("Gemini error:", error);
    console.error("Error message:", error?.message);

    if (error?.status === 429) {
      return Response.json(
        {
          error:
            "LUNA has reached her current usage limit. Please try again later.",
          type: "rate_limit",
        },
        { status: 429 }
      );
    }

    return Response.json(
      {
        error: "Something went wrong while talking to LUNA.",
        type: "unknown",
      },
      { status: 500 }
    );
  }
}