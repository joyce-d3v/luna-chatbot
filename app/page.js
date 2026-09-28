"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

export default function Home() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [interactionId, setInteractionId] = useState(null);
  const [copiedMessage, setCopiedMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const chatEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  // ---------- Load saved chats after hydration ----------

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

  // ---------- Save chats ----------

  useEffect(() => {
    if (!isLoaded) return;

    if (chats.length > 0) {
      localStorage.setItem(
        "luna-chats",
        JSON.stringify(chats)
      );
    } else {
      localStorage.removeItem("luna-chats");
    }
  }, [chats, isLoaded]);

  // ---------- Auto scroll ----------

 useEffect(() => {
  if (!chatEndRef.current) return;

  chatEndRef.current.scrollIntoView({
    behavior: "smooth",
  });
}, [messages.length]);

  // ---------- Create new chat ----------

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
    setSidebarOpen(false);
  }

  // ---------- Select chat ----------

  function selectChat(chat) {
    setCurrentChatId(chat.id);
    setMessages(chat.messages || []);
    setInteractionId(chat.interactionId || null);
    setSidebarOpen(false);
  }

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

  // ---------- Delete chat ----------

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
        setInteractionId(
          nextChat.interactionId || null
        );
      } else {
        setCurrentChatId(null);
        setMessages([]);
        setInteractionId(null);
      }
    }
  }

  // ---------- Send message ----------

  function stopGeneration() {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
  }

  setLoading(false);
}
  
  async function sendMessage() {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || loading) return;

    let chatId = currentChatId;

    // Create a chat automatically if needed
    if (!chatId) {
      const newChat = {
        id: Date.now().toString(),
        title:
          trimmedMessage.length > 32
            ? trimmedMessage.slice(0, 32) + "..."
            : trimmedMessage,
        messages: [],
        interactionId: null,
      };

      chatId = newChat.id;

      setChats((previous) => [
        newChat,
        ...previous,
      ]);

      setCurrentChatId(chatId);
    }

    const userMessage = {
      role: "user",
      content: trimmedMessage,
    };

    const updatedMessages = [
      ...messages,
      userMessage,
    ];

    setMessages(updatedMessages);
setMessage("");
setLoading(true);

const controller = new AbortController();
abortControllerRef.current = controller;

try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
          signal: controller.signal,
        body: JSON.stringify({
          message: trimmedMessage,
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
          if (chat.id !== chatId) {
            return chat;
          }

          let title = chat.title;

          if (title === "New conversation") {
            title =
              trimmedMessage.length > 32
                ? trimmedMessage.slice(0, 32) + "..."
                : trimmedMessage;
          }

          return {
            ...chat,
            title,
            messages: finalMessages,
            interactionId: data.interactionId,
          };
        })
      );
    } catch (error) {
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
    }
  }

  // ---------- Copy response ----------

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

  // ---------- Enter key ----------

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <main className="chat-page">
      <div
        className={`chat-shell ${
          sidebarOpen ? "sidebar-visible" : ""
        }`}
      >
        {/* ---------- Sidebar ---------- */}

        <aside className="chat-sidebar">
          <div className="sidebar-top">
            <div className="sidebar-brand">
              <div className="logo">✦</div>

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
                    onClick={() =>
                      deleteChat(chat.id)
                    }
                    aria-label="Delete conversation"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* ---------- Main chat ---------- */}

        <section className="chat-container">
          <header className="chat-header">
            <button
              className="mobile-menu"
              onClick={() =>
                setSidebarOpen(!sidebarOpen)
              }
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
                <div className="welcome-icon">
                  ✦
                </div>

                <h2>How can I help?</h2>

                <p>
                  Ask me anything. I can help you learn,
                  write, brainstorm, code, and more.
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
  {copiedMessage === index ? "Copied ✓" : "Copy"}
</button>
                          </div>
                        </>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="message assistant-message">
                    <div className="message-label">
                      LUNA
                    </div>

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

          <div className="input-area">
  <label className="file-upload-button" title="Attach a file">
    📎
    <input
      type="file"
      accept="image/*,.pdf,.txt,.doc,.docx"
      onChange={(event) => {
        setSelectedFile(event.target.files[0] || null);
      }}
    />
  </label>

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
  disabled={!loading && !message.trim()}
  aria-label={loading ? "Stop generation" : "Send message"}
>
  {loading ? "■" : "↑"}
</button>
          </div>

          <p className="disclaimer">
            AI can make mistakes. Check important information.
          </p>
        </section>
      </div>
    </main>
  );
}
