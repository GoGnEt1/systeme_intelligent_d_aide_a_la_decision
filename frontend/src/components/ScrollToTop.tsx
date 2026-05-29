import { useState, useEffect } from "react";
import { FaArrowUp } from "react-icons/fa";

const ScrollToTop = () => {
  const [visible, setVisible] = useState(false);

  // Affiche le bouton quand on scroll
  useEffect(() => {
    const toggleVisible = () => {
      setVisible(window.scrollY > 300); // seuil de 300px
    };

    window.addEventListener("scroll", toggleVisible);
    return () => window.removeEventListener("scroll", toggleVisible);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    visible && (
      <button
        onClick={scrollToTop}
        className="fixed bottom-6 right-6 bg-gognet-orange text-white p-3 rounded-full shadow-lg hover:bg-orange-600 transition duration-300 z-50"
        aria-label="Scroll to top"
        title="Scroller vers le haut"
      >
        <FaArrowUp />
      </button>
    )
  );
};

export default ScrollToTop;
