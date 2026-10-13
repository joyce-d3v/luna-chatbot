"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const MAX_FILE_SIZE = 3 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
"image/jpeg",
"image/png",
"image/gif",
"image/webp",
"application/pdf",
"text/plain",
"text/markdown",
"text/csv",
];

export default function Home() {
const [message, setMessage] = useState("");
const [messages, setMessages] = useState([]);
const [loading, setLoading] = useState(false);
const [selectedFile, setSelectedFile] = useState(null);
const [fileError, setFileError] = useState("");
const [interactionId, setInteractionId] = useState(null);
const [copiedMessage, setCopiedMessage] = useState(null);
const [searchQuery, setSearchQuery] = useState("");

const [chats, setChats] = useState([]);
const [currentChatId, setCurrentChatId] = useState(null);
const [sidebarOpen, setSidebarOpen] = useState(false);
const [isLoaded, setIsLoaded] = useState(false);

const chatEndRef = useRef(null);
const abortControllerRef = useRef(null);
const fileInputRef = useRef(null);

// Load saved conversations
useEffect(() => {
const loadChats = () => {
try {
const savedChats = localStorage.getItem("luna-chats");

    if (savedChats) {
      const parsedChats = JSON.parse(savedChats);

      if (Array.isArray(parsedChats)) {
        setChats(parsedChats);

        if (parsedChats.length > 0) {
          const latestChat = parsedChats[0];

          setCurrentChatId(latestChat.id);
          setMessages(latestChat.messages || []);
          setInteractionId(
            latestChat.interactionId || null
          );
        }
      }
    }
  } catch (error) {
    console.error("Could not load saved chats:", error);
  }

  setIsLoaded(true);
};

const timeout = setTimeout(loadChats, 0);

return () => clearTimeout(timeout);

}, []);

// Save conversations
useEffect(() => {
if (!isLoaded) return;
try {
  if (chats.length > 0) {
    localStorage.setItem(
      "luna-chats",
      JSON.stringify(chats)
    );
  } else {
    localStorage.removeItem("luna-chats");
  }
} catch (error) {
  console.error("Could not save conversations:", error);
}

}, [chats, isLoaded]);

// Automatically scroll to the latest message
useEffect(() => {
if (!chatEndRef.current) return;
chatEndRef.current.scrollIntoView({
  behavior: "smooth",
});

}, [messages.length]);

// Create a new conversation
function createNewChat() {
const newChat = {
id: Date.now().toString(),
title: "New conversation",
messages: [],
interactionId: null,
};
setChats((previous) => [newChat, ...previous]);
setCurrentChatId(newChat.id);
setMessages([]);
setInteractionId(null);
setSelectedFile(null);
setFileError("");
setSidebarOpen(false);

if (fileInputRef.current) {
  fileInputRef.current.value = "";
}

}

// Select a saved conversation
function selectChat(chat) {
setCurrentChatId(chat.id);
setMessages(chat.messages || []);
setInteractionId(chat.interactionId || null);
setSelectedFile(null);
setFileError("");
setSidebarOpen(false);
if (fileInputRef.current) {
  fileInputRef.current.value = "";
}

}

// Search conversations
const filteredChats = chats.filter((chat) => {
const query = searchQuery.trim().toLowerCase();
if (!query) return true;

const titleMatches = chat.title
  ?.toLowerCase()
  .includes(query);

const messageMatches = chat.messages?.some((msg) =>
  msg.content?.toLowerCase().includes(query)
);

return titleMatches || messageMatches;

});

// Delete a conversation
function deleteChat(chatId) {
const remainingChats = chats.filter(
(chat) => chat.id !== chatId
);

setChats(remainingChats);

if (chatId === currentChatId) {
  if (remainingChats.length > 0) {
    const nextChat = remainingChats[0];

    setCurrentChatId(nextChat.id);
    setMessages(nextChat.messages || []);
    setInteractionId(nextChat.interactionId || null);
  } else {
    setCurrentChatId(null);
    setMessages([]);
    setInteractionId(null);
  }

  setSelectedFile(null);
  setFileError("");

  if (fileInputRef.current) {
    fileInputRef.current.value = "";
  }
}

}

// Format file sizes
function formatFileSize(bytes) {
if (bytes < 1024) {
return `${bytes} B`;
}

if (bytes < 1024 * 1024) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

}

// Select and validate an attachment
function handleFileChange(event) {
const file = event.target.files?.[0];

setFileError("");

if (!file) return;

if (file.size === 0) {
  setSelectedFile(null);
  setFileError("This file is empty. Please choose another file.");
  event.target.value = "";
  return;
}

if (file.size > MAX_FILE_SIZE) {
  setSelectedFile(null);
  setFileError("Files must be 10 MB or smaller.");
  event.target.value = "";
  return;
}

const extension = file.name
  .split(".")
  .pop()
  .toLowerCase();

const allowedExtensions = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "pdf",
  "txt",
  "md",
  "csv",
];

if (
  !ALLOWED_FILE_TYPES.includes(file.type) &&
  !allowedExtensions.includes(extension)
) {
  setSelectedFile(null);
  setFileError(
    "This file type isn't supported yet. Choose an image, PDF, TXT, Markdown, or CSV file."
  );
  event.target.value = "";
  return;
}

setSelectedFile(file);

}

// Remove an attachment
function removeSelectedFile() {
setSelectedFile(null);
setFileError("");

if (fileInputRef.current) {
  fileInputRef.current.value = "";
}

}

// Stop an active request
function stopGeneration() {
if (abortControllerRef.current) {
abortControllerRef.current.abort();
abortControllerRef.current = null;
}

setLoading(false);

}

// Send a message or attachment
async function sendMessage() {
const trimmedMessage = message.trim();

if ((!trimmedMessage && !selectedFile) || loading) {
  return;
}

const fileToSend = selectedFile;

let chatId = currentChatId;

// Create a conversation automatically when needed
if (!chatId) {
  const initialTitle = fileToSend
    ? fileToSend.name
    : trimmedMessage;

  const newChat = {
    id: Date.now().toString(),
    title:
      initialTitle.length > 32
        ? initialTitle.slice(0, 32) + "..."
        : initialTitle,
    messages: [],
    interactionId: null,
  };

  chatId = newChat.id;

  setChats((previous) => [newChat, ...previous]);
  setCurrentChatId(chatId);
}

const userMessage = {
  role: "user",
  content: trimmedMessage || `Please examine this file: ${fileToSend.name}`,
  attachment: fileToSend
    ? {
        name: fileToSend.name,
        size: fileToSend.size,
        type: fileToSend.type,
      }
    : null,
};

const updatedMessages = [
  ...messages,
  userMessage,
];

setMessages(updatedMessages);
setMessage("");
setLoading(true);
setFileError("");

// Clear the textarea height after sending
const textarea = document.querySelector(".input-area textarea");

if (textarea) {
  textarea.style.height = "auto";
}

const controller = new AbortController();
abortControllerRef.current = controller;

try {
  // This request currently sends text only.
  // File transmission to Gemini is the next implementation step.
  let attachment = null;

if (fileToSend) {
  const fileData = await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string") {
        reject(new Error("Could not read the selected file."));
        return;
      }

      resolve(result.split(",")[1]);
    };

    reader.onerror = () => {
      reject(new Error("Could not read the selected file."));
    };

    reader.readAsDataURL(fileToSend);
  });

  attachment = {
    name: fileToSend.name,
    mimeType: fileToSend.type,
    data: fileData,
  };
}

const response = await fetch("/api/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  signal: controller.signal,
  body: JSON.stringify({
    message: trimmedMessage,
    attachment,
    previousInteractionId: interactionId,
  }),
});

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data.error || "Something went wrong."
    );

    error.type = data.type;

    throw error;
  }

  const assistantMessage = {
    role: "assistant",
    content: data.reply,
  };

  const finalMessages = [
    ...updatedMessages,
    assistantMessage,
  ];

  setMessages(finalMessages);
  setInteractionId(data.interactionId);

  setChats((previous) =>
    previous.map((chat) => {
      if (chat.id !== chatId) return chat;

      let title = chat.title;

      if (title === "New conversation") {
        const titleSource = trimmedMessage || fileToSend?.name || "New conversation";

        title =
          titleSource.length > 32
            ? titleSource.slice(0, 32) + "..."
            : titleSource;
      }

      return {
        ...chat,
        title,
        messages: finalMessages,
        interactionId: data.interactionId,
      };
    })
  );

  // Clear the attachment after a successful request
  setSelectedFile(null);

  if (fileInputRef.current) {
    fileInputRef.current.value = "";
  }
} catch (error) {
  if (error.name === "AbortError") {
    return;
  }

  console.error("LUNA error:", error);

  const errorMessage = {
    role: "error",
    content:
      error.type === "rate_limit"
        ? "LUNA has reached her current usage limit. Please try again later."
        : "Sorry, I couldn't respond right now. Please try again.",
  };

  setMessages([
    ...updatedMessages,
    errorMessage,
  ]);
} finally {
  setLoading(false);
  abortControllerRef.current = null;
}

}

// Copy an assistant response
async function copyResponse(content, messageIndex) {
try {
await navigator.clipboard.writeText(content);

  setCopiedMessage(messageIndex);

  setTimeout(() => {
    setCopiedMessage(null);
  }, 2000);
} catch (error) {
  console.error("Copy failed:", error);
}

}

// Send with Enter; Shift + Enter creates a new line
function handleKeyDown(event) {
if (event.key === "Enter" && !event.shiftKey) {
event.preventDefault();
sendMessage();
}
}

return ( <main className="chat-page">
<div
className={`chat-shell ${
          sidebarOpen ? "sidebar-visible" : ""
        }`}
> <aside className="chat-sidebar"> <div className="sidebar-top"> <div className="sidebar-brand"> <div className="logo">✦</div>

          <div>
            <h2>LUNA</h2>
            <span>AI Assistant</span>
          </div>
        </div>

        <button
          className="new-chat-button"
          onClick={createNewChat}
        >
          <span>＋</span>
          New chat
        </button>

        <div className="conversation-search">
          <span className="search-icon">⌕</span>

          <input
            type="text"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(event.target.value)
            }
            placeholder="Search conversations..."
          />

          {searchQuery && (
            <button
              className="clear-search"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="chat-list">
        {chats.length === 0 ? (
          <p className="empty-chats">
            Your conversations will appear here.
          </p>
        ) : filteredChats.length === 0 ? (
          <p className="empty-chats">
            No conversations match your search.
          </p>
        ) : (
          filteredChats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-history-item ${
                chat.id === currentChatId
                  ? "active-chat"
                  : ""
              }`}
            >
              <button
                className="chat-select"
                onClick={() => selectChat(chat)}
              >
                <span className="chat-icon">○</span>
                <span>{chat.title}</span>
              </button>

              <button
                className="delete-chat"
                onClick={() => deleteChat(chat.id)}
                aria-label="Delete conversation"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </aside>

    <section className="chat-container">
      <header className="chat-header">
        <button
          className="mobile-menu"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Open conversations"
        >
          ☰
        </button>

        <div className="header-logo">✦</div>

        <div>
          <h1>LUNA</h1>
          <p>AI Assistant</p>
        </div>
      </header>

      <section className="chat-area">
        {messages.length === 0 ? (
          <div className="welcome">
            <div className="welcome-icon">✦</div>

            <h2>How can I help?</h2>

            <p>
              Ask me anything. I can help you learn,
              write, brainstorm, code  and more.
            </p>
          </div>
        ) : (
          <div className="messages">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message ${
                  msg.role === "user"
                    ? "user-message"
                    : "assistant-message"
                }`}
              >
                <div className="message-label">
                  {msg.role === "user"
                    ? "You"
                    : msg.role === "error"
                    ? "Notice"
                    : "LUNA"}
                </div>

                <div className="message-content">
                  {msg.role === "assistant" ? (
                    <>
                      <ReactMarkdown>
                        {msg.content}
                      </ReactMarkdown>

                      <div className="message-actions">
                        <button
                          onClick={() =>
                            copyResponse(msg.content, index)
                          }
                          title="Copy response"
                        >
                          {copiedMessage === index
                            ? "Copied ✓"
                            : "Copy"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>{msg.content}</p>

                      {msg.attachment && (
                        <div className="sent-attachment">
                          <span>
                            {msg.attachment.type?.startsWith("image/")
                              ? "🖼️"
                              : "📄"}
                          </span>

                          <div>
                            <strong>{msg.attachment.name}</strong>
                            <small>
                              {formatFileSize(msg.attachment.size)}
                            </small>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="message assistant-message">
                <div className="message-label">LUNA</div>

                <div className="typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}
      </section>

      <div className="input-area-wrapper">
        {selectedFile && (
          <div className="attachment-preview">
            {selectedFile.type.startsWith("image/") ? (
              <img className="attachment-thumbnail" src={URL.createObjectURL(selectedFile)} alt="Selected attachment preview" />
            ) : (
              <div className="attachment-file-icon">
                📄
              </div>
            )}

            <div className="attachment-details">
              <strong title={selectedFile.name}>
                {selectedFile.name}
              </strong>

              <span>
                {formatFileSize(selectedFile.size)}
              </span>
            </div>

            <button
              className="remove-attachment"
              onClick={removeSelectedFile}
              disabled={loading}
              aria-label="Remove attachment"
              title="Remove attachment"
            >
              ×
            </button>
          </div>
        )}

        {fileError && (
          <p className="attachment-error" role="alert">
            {fileError}
          </p>
        )}

        <div className="input-area">
          <button
            type="button"
            className="file-upload-button"
            title="Attach a file"
            aria-label="Attach a file"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            📎
          </button>

          <input
            ref={fileInputRef}
            className="hidden-file-input"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/markdown,text/csv,.jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.md,.csv"
            onChange={handleFileChange}
            disabled={loading}
          />

          <textarea
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);

              event.target.style.height = "auto";

              event.target.style.height = `${Math.min(
                event.target.scrollHeight,
                160
              )}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              loading
                ? "LUNA is thinking..."
                : "Ask me anything..."
            }
            rows="1"
            disabled={loading}
          />

          <button
            onClick={loading ? stopGeneration : sendMessage}
            disabled={
              !loading && !message.trim() && !selectedFile
            }
            aria-label={
              loading ? "Stop generation" : "Send message"
            }
          >
            {loading ? "■" : "↑"}
          </button>
        </div>
      </div>

      <p className="disclaimer">
        AI can make mistakes. Check important information.
      </p>
    </section>
  </div>
</main>

);
}
