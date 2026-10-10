import { useEffect, useRef, useState } from "react";
import AssistantMessage from "./components/AssistantMessage.jsx";
import {
  analyzeWithAssistant,
  createConversation,
  getAssistantConfig,
  getLibraryContext,
  loadLatestConversation,
  saveConversationMessage,
} from "./services/assistantService.js";
import "./AIAssistantPage.css";

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  text: "Hello! Tell me what topic you are researching, or upload your own document for analysis. I can help find library references and explain ideas, but I cannot write a new journal article or assignment for you.",
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export default function AIAssistantPage() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [conversation, setConversation] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState(null);
  const [uploadKind, setUploadKind] = useState("file");
  const [assistantConfig, setAssistantConfig] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [catalogWarning, setCatalogWarning] = useState("");
  const [catalogBooks, setCatalogBooks] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    getAssistantConfig()
      .then((config) => {
        if (active) setAssistantConfig(config);
      })
      .catch((configError) => {
        if (active)
          setError(`Could not load your AI plan: ${configError.message}`);
      });

    getLibraryContext()
      .then((books) => {
        if (active) setCatalogBooks(books);
      })
      .catch((catalogError) => {
        if (active) {
          setCatalogWarning(
            `Book covers and library references are unavailable right now (${catalogError.message}).`,
          );
        }
      });

    loadLatestConversation()
      .then((result) => {
        if (!active || !result) return;
        setConversation(result.conversation);
        setMessages([WELCOME_MESSAGE, ...result.messages]);
      })
      .catch((historyError) => {
        if (active)
          setError(
            `Could not load your saved assistant chat: ${historyError.message}`,
          );
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, progress]);

  function handleUploadChange(event, kind) {
    const selectedFile = event.target.files?.[0] ?? null;
    event.target.value = "";
    setError("");
    if (!selectedFile) return;
    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      setFile(null);
      setError("Choose an image or file that is 10 MB or smaller.");
      return;
    }
    if (
      kind === "image" &&
      !["image/jpeg", "image/png", "image/webp"].includes(selectedFile.type)
    ) {
      setFile(null);
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (kind === "file" && !/\.(txt|pdf|docx)$/i.test(selectedFile.name)) {
      setFile(null);
      setError("Choose a TXT, PDF, or DOCX document.");
      return;
    }
    setFile(selectedFile);
    setUploadKind(kind);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const userText = prompt.trim();
    if ((!userText && !file) || isLoading || loadingHistory || !assistantConfig)
      return;

    const currentPrompt =
      userText ||
      `Please analyze the uploaded ${uploadKind === "image" ? "image" : "file"}: ${file.name}`;
    setPrompt("");
    setError("");
    setCatalogWarning("");
    setIsLoading(true);
    setProgress("Preparing your request");

    try {
      const activeConversation =
        conversation ??
        (await createConversation(currentPrompt, assistantConfig.model));
      setConversation(activeConversation);

      const savedUserMessage = await saveConversationMessage({
        conversationId: activeConversation.id,
        sender: "user",
        content: currentPrompt,
        attachmentName: file?.name ?? null,
        model: assistantConfig.model,
      });
      setMessages((current) => [...current, savedUserMessage]);

      let libraryContext = [];
      try {
        setProgress("Searching the library catalog");
        libraryContext = await getLibraryContext();
        setCatalogBooks(libraryContext);
      } catch (catalogError) {
        setCatalogWarning(
          `Library references are unavailable right now (${catalogError.message}). The assistant will avoid claiming a title is in your library.`,
        );
      }

      const history = messages
        .filter((message) => message.id !== "welcome")
        .slice(-12)
        .map((message) => ({ role: message.role, content: message.text }));

      const result = await analyzeWithAssistant({
        prompt: currentPrompt,
        history,
        libraryContext,
        file: uploadKind === "file" ? file : null,
        image: uploadKind === "image" ? file : null,
        onProgress: setProgress,
      });

      const savedAssistantMessage = await saveConversationMessage({
        conversationId: activeConversation.id,
        sender: "assistant",
        content: result.answer,
        model: result.model,
      });
      setMessages((current) => [...current, savedAssistantMessage]);
      setFile(null);
    } catch (requestError) {
      setError(
        requestError.message ||
          "The assistant could not complete your request.",
      );
    } finally {
      setIsLoading(false);
      setProgress("");
    }
  }

  function startNewConversation() {
    setConversation(null);
    setMessages([WELCOME_MESSAGE]);
    setFile(null);
    setPrompt("");
    setError("");
    setCatalogWarning("");
  }

  return (
    <section className="ai-assistant">
      <header className="ai-assistant__header">
        <div>
          <h1>AI Research Assistant</h1>
          <p>
            Explore topics, analyze your notes, make cautious predictions, and
            discover library references.
          </p>
        </div>
        <div className="ai-assistant__model" aria-live="polite">
          <strong>
            {assistantConfig
              ? assistantConfig.role === "staff"
                ? "Staff AI"
                : "Member AI"
              : "AI assistant"}
          </strong>
          <span>
            {assistantConfig
              ? `${assistantConfig.model_label} · up to ${assistantConfig.max_tokens.toLocaleString()} response tokens`
              : "Loading your AI settings…"}
          </span>
          {assistantConfig && (
            <span>
              Image analysis uses {assistantConfig.image_model_label}.
            </span>
          )}
        </div>
      </header>

      <div className="ai-assistant__privacy">
        Do not Share sensitive personal information. The assistant is not a
        substitute for professional advice.
      </div>

      <div className="ai-assistant__toolbar">
        <span>Your conversation is private to your account.</span>
        <button
          type="button"
          onClick={startNewConversation}
          disabled={isLoading || loadingHistory}
        >
          New chat
        </button>
      </div>

      <div
        className="ai-assistant__transcript"
        aria-live="polite"
        aria-busy={isLoading}
      >
        {loadingHistory ? (
          <p className="ai-assistant__state" role="status">
            Loading your saved conversation…
          </p>
        ) : (
          messages.map((message) => (
            <AssistantMessage
              key={message.id}
              message={message}
              allowedImageUrls={catalogBooks
                .map((book) => book.cover_url)
                .filter(Boolean)}
            />
          ))
        )}
        {progress && (
          <div className="ai-assistant__progress" role="status">
            <span className="ai-assistant__spinner" aria-hidden="true" />
            <span>{progress}…</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {catalogWarning && (
        <p className="ai-assistant__warning" role="status">
          {catalogWarning}
        </p>
      )}
      {error && (
        <p className="ai-assistant__error" role="alert">
          {error}
        </p>
      )}

      <form className="ai-assistant__composer" onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => handleUploadChange(event, "file")}
          tabIndex={-1}
        />
        <input
          ref={imageInputRef}
          className="visually-hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => handleUploadChange(event, "image")}
          tabIndex={-1}
        />
        {file && (
          <div className="ai-assistant__file">
            <span>
              {uploadKind === "image" ? "Image" : "File"}: {file.name}
            </span>
            <button
              type="button"
              onClick={() => setFile(null)}
              aria-label="Remove attachment"
            >
              Remove
            </button>
          </div>
        )}
        <div className="ai-assistant__composer-row">
          <button
            className="ai-assistant__attach"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || loadingHistory || !assistantConfig}
            aria-label="Choose a document to upload"
            title="Upload TXT, PDF, or DOCX (max 10 MB)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m21.4 11.1-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.2a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5" />
            </svg>
          </button>
          <button
            className="ai-assistant__attach"
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isLoading || loadingHistory || !assistantConfig}
            aria-label="Choose an image to upload"
            title="Upload JPEG, PNG, or WebP (max 10 MB)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="9" r="1.5" />
              <path d="m21 15-5-5L5 20" />
            </svg>
          </button>
          <label className="visually-hidden" htmlFor="assistant-prompt">
            Your research question
          </label>
          <textarea
            id="assistant-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.isComposing
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Ask for references or feedback… (Enter to send, Shift+Enter for a new line)"
            rows={2}
            maxLength={assistantConfig?.max_prompt_chars ?? 4000}
            disabled={isLoading || loadingHistory}
          />
          <button
            className="ai-assistant__send"
            type="submit"
            disabled={
              isLoading ||
              loadingHistory ||
              !assistantConfig ||
              (!prompt.trim() && !file)
            }
            aria-label="Send request"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m22 2-7 20-4-9-9-4z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
      </form>
    </section>
  );
}
