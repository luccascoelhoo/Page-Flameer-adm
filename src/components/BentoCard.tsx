import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface BentoCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
}

const BentoCard = ({ children, className, ...props }: BentoCardProps) => {
  return (
    <motion.div
      className={cn("bento-card", className)}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default BentoCard;
