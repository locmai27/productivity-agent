import { motion, Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Calendar, Check, GripVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const navigate = useNavigate();

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
    },
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background Effects */}
      <div className="absolute inset-0 hero-gradient" />
      <div className="absolute inset-0 grid-pattern opacity-30" />
      
      {/* Floating Orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl"
        animate={{
          x: [0, 50, 0],
          y: [0, -30, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-glow-secondary/10 rounded-full blur-3xl"
        animate={{
          x: [0, -40, 0],
          y: [0, 40, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center max-w-4xl mx-auto"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card text-sm text-muted-foreground border border-primary/20">
              <Sparkles className="w-4 h-4 text-primary" />
              Powered by AI
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6"
          >
            Your calendar,{" "}
            <span className="gradient-text">supercharged</span>{" "}
            with AI
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={itemVariants}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8"
          >
            An intelligent calendar that learns your habits, manages your tasks,
            and keeps you organized. Just tell it what you need.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Button variant="hero" size="xl" className="group" onClick={() => {
              navigate('/signup');
            }}>
              Get started
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="hero-outline" size="xl">
              Watch demo
            </Button>
          </motion.div>

          {/* Calendar Preview */}
          <motion.div
            variants={itemVariants}
            className="relative max-w-3xl mx-auto"
          >
            <div className="glass-card p-6 rounded-2xl glow-effect">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span className="font-medium">January 2026</span>
                </div>
                <div className="flex gap-2">
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                    <span
                      key={i}
                      className="w-10 text-center text-sm text-muted-foreground"
                    >
                      {day}
                    </span>
                  ))}
                </div>
              </div>

              {/* Calendar Grid Preview */}
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 14 }, (_, i) => {
                  const day = i + 12;
                  const hasTask = [13, 14, 16, 18, 20].includes(day);
                  const isToday = day === 14;

                  return (
                    <motion.div
                      key={i}
                      whileHover={{ scale: 1.05 }}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-start p-2 cursor-pointer transition-colors ${
                        isToday
                          ? "bg-primary/20 border border-primary/50"
                          : "bg-secondary/50 hover:bg-secondary"
                      }`}
                    >
                      <span className={`text-sm ${isToday ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                        {day}
                      </span>
                      {hasTask && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.8 + i * 0.1 }}
                          className="mt-1 w-full"
                        >
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/20 text-xs text-primary truncate">
                            <GripVertical className="w-2 h-2 opacity-50" />
                            <span className="truncate">Task</span>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* AI Chat Preview */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className="mt-6 p-4 rounded-xl bg-secondary/50 border border-border/50"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      <span className="text-foreground font-medium">AI:</span>{" "}
                      I've moved your meeting to Thursday and set a reminder for 30 minutes before.{" "}
                      <Check className="w-4 h-4 inline text-green-500" />
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl animate-pulse-glow" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-glow-secondary/20 rounded-full blur-2xl animate-pulse-glow" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
