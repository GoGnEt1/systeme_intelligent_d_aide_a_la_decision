import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { User } from "../../types";
import { CiUser, CiSettings, CiLogout } from "react-icons/ci";
import useOnclickOutside from "../ui/useOnclickOutside";

const AvatarMenu: React.FC<{
  user_current: User | null;
  onProfile: () => void;
  onSettings: () => void;
  onLogout: () => void;
}> = ({ user_current: user_c, onProfile, onSettings, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useOnclickOutside(ref, () => setIsOpen(false));

  const toggleMenu = () => setIsOpen((prevState) => !prevState);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen ? "true" : "false"}
        aria-controls="menu"
        onClick={toggleMenu}
      >
        {user_c?.profile_image ? (
          <img
            src={user_c?.profile_image}
            alt={user_c?.first_name}
            className="w-9 h-9 object-cover rounded-full cursor-pointer"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gognet-orange flex items-center justify-center text-2xl font-black text-gognet-dark">
            {user_c?.first_name?.[0]?.toUpperCase()}
            {user_c?.last_name?.[0]?.toUpperCase()}
          </div>
          // <div className="w-9 h-9 flex items-center justify-center bg-blue-100 rounded-full text-2xl text-gray-400">
          //   {user_c?.first_name?.charAt(0).toUpperCase() || "N"}
          // </div>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            // initial={{ opacity: 0, translateY: -6 }}
            // animate={{ opacity: 1, translateY: 0 }}
            transition={{ duration: 0.2 }}
            className={`absolute top-11 z-50 mt-2 w-56 rounded-md shadow-lg bg-white
              right-0 origin-top-right
            `}
          >
            <div className="p-2 border-b">
              <p className=" text-gray-500 text-center">
                {user_c?.first_name} {user_c?.last_name}
              </p>
            </div>
            <div className="p-1 text-sm">
              <button
                onClick={() => {
                  onProfile();
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 w-full px-2 py-2 rounded hover:bg-gray-50"
              >
                <CiUser className="w-5 h-5" /> <span>Mon compte</span>
              </button>
              <button
                onClick={() => {
                  onSettings();
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 w-full px-2 py-2 rounded hover:bg-gray-50"
              >
                <CiSettings className="w-5 h-5" />{" "}
                <span>Paramètres du compte</span>
              </button>

              <button
                onClick={() => {
                  onLogout();
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 w-full px-2 py-2 rounded text-red-800 hover:bg-red-50"
              >
                <CiLogout className="w-5 h-5" /> <span>Se deconnecter</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AvatarMenu;
