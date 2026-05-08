import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCreateOpenaiConversation, useGetOpenaiConversation, getGetOpenaiConversationQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type Message = {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
};

export default function AiAssistant() {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const createConversation = useCreateOpenaiConversation();
  const { data: conversation, isLoading: isLoadingConv } = useGetOpenaiConversation(
    conversationId!,
    { query: { enabled: !!conversationId, queryKey: getGetOpenaiConversationQueryKey(conversationId!) } }
  );

  // Initialize conversation
  useEffect(() => {
    if (!conversationId && !createConversation.isPending && !createConversation.isSuccess) {
      createConversation.mutate({ data: { title: "New Consultation" } }, {
        onSuccess: (data) => {
          setConversationId(data.id);
          setMessages([
            {
              id: Date.now(),
              role: "assistant",
              content: "Welcome to Sediba. I am Sedi, your personal concierge. How may I assist you with our aesthetic or wellness treatments today?"
            }
          ]);
        }
      });
    }
  }, [conversationId, createConversation]);

  // Load existing messages if refetched
  useEffect(() => {
    if (conversation?.messages && conversation.messages.length > 0) {
      // Only set if we have more messages from server to prevent overriding local optimistic state during stream
      if (conversation.messages.length > messages.length) {
        setMessages(conversation.messages as Message[]);
      }
    }
  }, [conversation]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || !conversationId || isTyping) return;

    const userMessageContent = input;
    setInput("");
    
    // Optimistic UI update
    const tempUserMessage: Message = { id: Date.now(), role: "user", content: userMessageContent };
    setMessages(prev => [...prev, tempUserMessage]);
    setIsTyping(true);

    // Create a temporary assistant message for streaming
    const tempAssistantId = Date.now() + 1;
    setMessages(prev => [...prev, { id: tempAssistantId, role: "assistant", content: "" }]);

    try {
      const response = await fetch(`/api/openai/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessageContent }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) {
                // Refresh the conversation to get final saved state and real IDs
                queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(conversationId) });
                break;
              }
              if (data.content) {
                assistantContent += data.content;
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === tempAssistantId 
                      ? { ...msg, content: assistantContent } 
                      : msg
                  )
                );
              }
            } catch (e) {
              console.error("Error parsing SSE JSON", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => prev.filter(msg => msg.id !== tempAssistantId));
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen pt-32 pb-10 bg-background flex flex-col items-center">
      <div className="container max-w-4xl px-6 flex-1 flex flex-col">
        <div className="text-center mb-8">
          <span className="text-primary font-sans uppercase tracking-[0.2em] text-xs mb-4 block flex justify-center items-center gap-2">
            <Sparkles size={12} /> AI Concierge
          </span>
          <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-2">Chat with Sedi</h1>
          <p className="text-muted-foreground font-light text-sm max-w-xl mx-auto">
            Explore treatments, understand procedures, and find available appointments through our intelligent assistant.
          </p>
        </div>

        <div className="flex-1 bg-card border border-border flex flex-col h-[60vh] min-h-[500px] shadow-sm relative overflow-hidden">
          {/* Header */}
          <div className="h-16 border-b border-border bg-muted/20 flex items-center px-6 shrink-0">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse mr-3" />
            <span className="font-serif text-lg text-foreground">Sedi</span>
          </div>

          {/* Messages */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
          >
            {createConversation.isPending ? (
              <div className="flex justify-center items-center h-full text-muted-foreground text-sm uppercase tracking-widest">
                Initializing Concierge...
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div 
                      className={`max-w-[80%] p-4 text-sm leading-relaxed ${
                        msg.role === "user" 
                          ? "bg-foreground text-background" 
                          : "bg-muted/30 text-foreground border border-border"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <div className="max-w-[80%] p-4 bg-muted/30 border border-border flex space-x-1.5 items-center h-12">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-background border-t border-border shrink-0">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex space-x-4"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about treatments or availability..."
                disabled={isTyping || createConversation.isPending}
                className="flex-1 rounded-none border-border bg-background focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-12"
              />
              <Button 
                type="submit" 
                disabled={!input.trim() || isTyping || createConversation.isPending}
                className="rounded-none h-12 px-6 bg-foreground hover:bg-foreground/90 text-background"
              >
                <Send size={18} />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
