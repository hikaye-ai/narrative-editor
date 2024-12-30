import React, { useEffect } from 'react';
import PropTypes from 'prop-types';

export const Notification = ({ message, onHide }) => {
  useEffect(() => {
    const timer = setTimeout(onHide, 2000);
    return () => clearTimeout(timer);
  }, [onHide]);

  return (
    <div className="fixed top-24 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg animate-fade-in-out">
      {message}
    </div>
  );
};

Notification.propTypes = {
  message: PropTypes.string.isRequired,
  onHide: PropTypes.func.isRequired
}; 