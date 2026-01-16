import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { io, Socket } from "socket.io-client";
import { auth } from "@/firebase";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:5001";

export function ChatbotModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [rememberConversation, setRememberConversation] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hi! I'm your calendar assistant. How can I help you today? I can help you create tasks, set reminders, or manage your schedule.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (isOpen && auth.currentUser) {
      // Connect to WebSocket when modal opens
      const user_id = auth.currentUser.uid;
      const socket = io(WS_URL, {
        auth: { user_id },
        query: { user_id },
        transports: ['websocket', 'polling']
      });

      socket.on('connect', () => {
        console.log('Connected to WebSocket');
        setIsConnected(true);
      });

      socket.on('connected', (data) => {
        console.log('WebSocket connection confirmed:', data);
        setIsConnected(true);
      });

      // Load conversation history from backend (Backboard thread)
      (async () => {
        try {
          const res = await fetch(`${WS_URL}/api/chat/history`, {
            headers: { "X-User-ID": user_id },
          });
          const data = await res.json();
          if (!res.ok || !data?.ok) return;
          const thread = data.thread;
          const msgs = Array.isArray(thread?.messages) ? thread.messages : [];
          const mapped: Message[] = msgs
            .map((m: any) => {
              const role = (m?.role === "assistant" || m?.role === "user") ? m.role : "assistant";
              const content = typeof m?.content === "string" ? m.content : (typeof m?.message === "string" ? m.message : "");
              if (!content) return null;
              return { id: String(m?.message_id || m?.id || Date.now() + Math.random()), role, content };
            })
            .filter(Boolean) as Message[];

          if (mapped.length > 0) {
            setMessages(mapped);
          }
        } catch {
          // ignore history load failures
        }
      })();

      socket.on('message', (data: { role: string; content: string }) => {
        // The UI already appends the user's message locally on send.
        // The server should not echo it, but ignore it here too to avoid duplicates.
        if (data.role === "user") return;
        const newMessage: Message = {
          id: Date.now().toString(),
          role: data.role as "user" | "assistant",
          content: data.content,
        };
        setMessages((prev) => [...prev, newMessage]);
        setIsLoading(false);
      });

      socket.on('error', (error: { message: string }) => {
        console.error('WebSocket error:', error);
        const errorMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: `Error: ${error.message}`,
        };
        setMessages((prev) => [...prev, errorMessage]);
        setIsLoading(false);
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket');
        setIsConnected(false);
      });

      socket.on('calendar_updated', () => {
        window.dispatchEvent(new Event("calendar-updated"));
      });

      socketRef.current = socket;

      return () => {
        socket.disconnect();
        socketRef.current = null;
      };
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim() || !socketRef.current || !isConnected || isLoading || isIndexing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    
    // Send message via WebSocket
    socketRef.current.emit('message', {
      user_id: auth.currentUser?.uid,
      message: input.trim(),
      remember: rememberConversation,
    });

    setInput("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const user = auth.currentUser;
      if (!user) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: "Please sign in before uploading files.",
          },
        ]);
        return;
      }

      setIsIndexing(true);
      setUploadProgress(0);

      const form = new FormData();
      form.append("file", file);

      // Use XHR so we can show upload progress
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${WS_URL}/api/chat/upload`);
      xhr.setRequestHeader("X-User-ID", user.uid);

      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return;
        const pct = Math.round((evt.loaded / evt.total) * 100);
        setUploadProgress(pct);
      };

      xhr.onload = async () => {
        try {
          const data = JSON.parse(xhr.responseText || "{}");
          if (xhr.status < 200 || xhr.status >= 300 || !data?.ok) {
            throw new Error(data?.error || `Upload failed (${xhr.status})`);
          }

          const uploadedName = data?.filename || file.name;
          const docs = Array.isArray(data?.documents) ? data.documents : [];
          const docCount = docs.length;
          const note = data?.note ? ` (${data.note})` : "";
          const ocrAttached = Boolean(data?.ocr_attached);
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: `Uploaded "${uploadedName}". I’m indexing it now… (${docCount} document(s) in this thread)${note}`,
            },
          ]);

          if (ocrAttached) {
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now().toString(),
                role: "assistant",
                content: `OCR text attached. Tell me what you want me to do with it (e.g., “extract deadlines and add them to my calendar this week”).`,
              },
            ]);
          } else {
            // Poll for document indexing completion
            const poll = async () => {
              const res = await fetch(`${WS_URL}/api/chat/documents`, {
                headers: { "X-User-ID": user.uid },
              });
              const body = await res.json().catch(() => ({}));
              const docs = Array.isArray(body?.documents) ? body.documents : [];
              const pending = docs.some((d: any) => {
                const s = String(d?.status || "").toLowerCase();
                return ["pending", "processing", "indexing"].includes(s);
              });
              if (pending) return false;
              if (docs.length === 0) return false;
              return true;
            };

            const started = Date.now();
            while (Date.now() - started < 120_000) {
              // eslint-disable-next-line no-await-in-loop
              const done = await poll();
              if (done) break;
              // eslint-disable-next-line no-await-in-loop
              await new Promise((r) => setTimeout(r, 2000));
            }

            const res2 = await fetch(`${WS_URL}/api/chat/documents`, {
              headers: { "X-User-ID": user.uid },
            });
            const body2 = await res2.json().catch(() => ({}));
            const docs2 = Array.isArray(body2?.documents) ? body2.documents : [];
            const docNames = docs2.map((d: any) => d?.filename).filter(Boolean);
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now().toString(),
                role: "assistant",
                content: `Indexing complete. I can see: ${docNames.length ? docNames.join(", ") : "no documents"}. Tell me what you want me to do with it (e.g., “extract deadlines and add them to my calendar this week”).`,
              },
            ]);
          }
        } catch (err) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: `Upload error: ${err instanceof Error ? err.message : "unknown error"}`,
            },
          ]);
        } finally {
          setUploadProgress(null);
          setIsIndexing(false);
          // reset file input so selecting same file again triggers change
          e.target.value = "";
        }
      };

      xhr.onerror = () => {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: "Upload error: network error",
          },
        ]);
        setUploadProgress(null);
        setIsIndexing(false);
        e.target.value = "";
      };

      xhr.send(form);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center z-50 hover:shadow-primary/40 transition-shadow"
      >
        <MessageCircle className="h-6 w-6" />
      </motion.button>

      {/* Modal Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed bottom-24 right-6 w-[400px] max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-8rem)] glass-card rounded-xl border border-border/50 shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <MessageCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">AI Assistant</h3>
                    <p className="text-xs text-muted-foreground">Always ready to help</p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/50 text-foreground"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted/50 text-foreground p-3 rounded-lg">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t border-border/50 space-y-3">
                {/* Remember Conversation Toggle */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="remember-mode" className="text-sm text-muted-foreground">
                    Remember this conversation
                  </Label>
                  <Switch
                    id="remember-mode"
                    checked={rememberConversation}
                    onCheckedChange={setRememberConversation}
                  />
                </div>
                
                {/* Input and Buttons */}
                <div className="flex gap-2">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    title="Upload file"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      !isConnected
                        ? "Connecting..."
                        : isIndexing
                          ? "Indexing document…"
                          : isLoading
                            ? "Thinking…"
                            : "Ask me anything..."
                    }
                    className="flex-1 bg-background/50"
                    disabled={!isConnected || isLoading || isIndexing}
                    onKeyDown={(e) => e.key === "Enter" && !isLoading && !isIndexing && handleSend()}
                  />
                  <Button size="icon" onClick={handleSend} disabled={!isConnected || isLoading || isIndexing}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                {uploadProgress !== null && (
                  <p className="text-xs text-muted-foreground">Uploading: {uploadProgress}%</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
