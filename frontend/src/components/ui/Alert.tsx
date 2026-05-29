import { motion } from "framer-motion";

type AlertProps = {
  message: string;
  type: "success" | "error";
};

const Alert = ({ message, type }: AlertProps) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className={`p-3 rounded-md text-sm font-medium mb-3 ${
      type === "success"
        ? "bg-green-100 text-green-700 border border-green-300"
        : "bg-red-100 text-red-700 border border-red-300"
    }`}
  >
    {message}
  </motion.div>
);

export default Alert;
