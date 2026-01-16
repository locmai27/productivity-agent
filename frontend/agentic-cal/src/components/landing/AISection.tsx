import { motion } from "framer-motion";
import { Sparkles, Send, CheckCircle2, Bell, Calendar, Trash2 } from "lucide-react";

const capabilities = [
  { icon: Calendar, text: "Create and schedule tasks" },
  { icon: Bell, text: "Set reminders and notifications" },
  { icon: CheckCircle2, text: "Mark tasks as complete" },
  { icon: Trash2, text: "Delete or reschedule tasks" },
];

const chatMessages = [
  { role: "user", text: "Move my dentist appointment to next Friday" },
  { role: "ai", text: "Done! I've moved your dentist appointment to Friday, January 23rd at 2:00 PM. I'll remind you the day before." },
  { role: "user", text: "What do I have scheduled this week?" },
  { role: "ai", text: "You have 5 tasks this week: Team standup (Mon), Project review (Tue), Dentist (moved to Fri), and 2 recurring daily tasks." },
];

const AISection = () => {
  return (
    <section id="ai" className="py-24 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-card text-sm text-primary border border-primary/20 mb-4">
              <Sparkles className="w-4 h-4" />
              AI Assistant
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
              Your personal{" "}
              <span className="gradient-text">AI calendar assistant</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Just tell it what you need. Our AI understands natural language,
              remembers your preferences, and manages your calendar like a 
              personal assistant.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {capabilities.map((cap, index) => (
                <motion.div
                  key={cap.text}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <cap.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-foreground">{cap.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Chat Preview */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="glass-card rounded-2xl p-6 glow-effect">
              {/* Chat Header */}
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/50">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold">AgenticCal AI</h4>
                  <p className="text-sm text-muted-foreground">Always learning, always helpful</p>
                </div>
                <div className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              </div>

              {/* Messages */}
              <div className="space-y-4 mb-6 max-h-80 overflow-y-auto">
                {chatMessages.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.15 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-secondary text-foreground rounded-bl-md"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Input */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border/50">
                <input
                  type="text"
                  placeholder="Ask me anything..."
                  className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-sm"
                  readOnly
                />
                <button className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors">
                  <Send className="w-4 h-4 text-primary-foreground" />
                </button>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-glow-secondary/15 rounded-full blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AISection;
