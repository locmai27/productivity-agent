import { motion, Variants } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  GripVertical,
  Tag,
  Bell,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Smart Calendar View",
    description:
      "Visualize your tasks across days, weeks, or months. Everything stays organized and accessible.",
  },
  {
    icon: GripVertical,
    title: "Drag & Drop Tasks",
    description:
      "Easily reschedule by dragging tasks between dates. Your due dates update automatically.",
  },
  {
    icon: CheckCircle2,
    title: "Task Management",
    description:
      "Create tasks with titles, descriptions, and track completion status at a glance.",
  },
  {
    icon: Tag,
    title: "Custom Tags",
    description:
      "Organize with priority levels, categories, and custom tags you create yourself.",
  },
  {
    icon: Bell,
    title: "Smart Reminders",
    description:
      "Never miss a deadline with push notifications and customizable reminder schedules.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered",
    description:
      "Your intelligent assistant can manage everything—just tell it what you need.",
  },
];

const FeaturesSection = () => {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
    },
  };

  return (
    <section id="features" className="py-24 relative">
      <div className="absolute inset-0 hero-gradient opacity-50" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-3 py-1 rounded-full glass-card text-sm text-primary border border-primary/20 mb-4">
            Features
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Everything you need to stay{" "}
            <span className="gradient-text">organized</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful features designed to make task management effortless
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              variants={itemVariants}
              whileHover={{ y: -5, scale: 1.02 }}
              className="group glass-card p-6 rounded-2xl hover:border-primary/30 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturesSection;
