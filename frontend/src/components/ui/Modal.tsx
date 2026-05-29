import { FiX } from "react-icons/fi";
// ─────────────────────────────────────────────────────────────
//  MODAL GÉNÉRIQUE
// ─────────────────────────────────────────────────────────────
export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-card border w-full max-w-2xl mx-auto text-gognet-gray">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-[18px]">{title}</h2>
          <button
            aria-label="Fermez"
            title="Fermez"
            onClick={onClose}
            className="p-2 hover:bg-red-100 rounded-full transition-colors"
          >
            <FiX size={18} />
          </button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
