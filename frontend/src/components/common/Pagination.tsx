import React from "react";
import { GrPrevious } from "react-icons/gr";
type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const getPageNumbers = () => {
    const pageNumbers: (number | string)[] = [];
    const delta = 1;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      pageNumbers.push(1);

      if (currentPage - delta > 2) {
        pageNumbers.push("...");
      }

      for (
        let i = Math.max(2, currentPage - delta);
        i <= Math.min(totalPages - 1, currentPage + delta);
        i++
      ) {
        if (i > 1 && i < totalPages) {
          pageNumbers.push(i);
        }
      }

      if (currentPage + delta < totalPages - 1) {
        pageNumbers.push("...");
      }

      if (totalPages > 1) {
        pageNumbers.push(totalPages);
      }
    }

    return pageNumbers;
  };

  return (
    <div className="flex items-center gap-2">
      {/* <div className="pagination"> */}
      <button
        title="previous page"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50 hover:bg-gray-300 transition-colors duration-300"
      >
        <GrPrevious size={25} />
      </button>
      {getPageNumbers().map((page, index) =>
        typeof page === "string" ? (
          <span key={index} className="px-2">
            {page}
          </span>
        ) : (
          <button
            key={index}
            onClick={() => onPageChange(page)}
            className={`px-3 cursor-pointer py-1 rounded ${
              page === currentPage
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-800"
            }`}
          >
            {page}
          </button>
        ),
      )}
      <button
        title="next page"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50 hover:bg-gray-300 transition-colors duration-300"
      >
        <GrPrevious size={25} className="rotate-180" />
      </button>
    </div>
    // </div>
  );
};

export default Pagination;
