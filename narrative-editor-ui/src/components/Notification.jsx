import React, { useEffect } from 'react';

export const Notification = ({ message, onHide }) => {
  useEffect(() => {
    const timer = setTimeout(onHide, 2000); // Hide after 2 seconds
    return () => clearTimeout(timer);
  }, [onHide]);

  return (
    <div className="fixed top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg animate-fade-in-out">
      {message}
    </div>
  );
};

// Add a default export as well
export default Notification; 