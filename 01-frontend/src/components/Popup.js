import React, { useEffect, useRef } from 'react';

const Popup = ({ metadata, onClose, onAccept, onReject }) => {
  const popupRef = useRef();

  const handleClickOutside = (event) => {
    if (popupRef.current && !popupRef.current.contains(event.target)) {
      onClose();
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!metadata) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center">
      <div ref={popupRef} className="bg-white p-6 rounded shadow-lg max-w-md w-full text-black">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-600 hover:text-gray-900">
          &times;
        </button>
        <h2 className="text-xl mb-2">Change Information:</h2>
        <p>Last Updated: {metadata.last_updated}</p>
        <p>Reason: {metadata.update_reason}</p>
        <p>Summary: {metadata.change_summary}</p>
        <a href={metadata.reference_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          More Information
        </a>
        <div className="mt-4">
          <button onClick={onAccept} className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mr-2">
            Accept
          </button>
          <button onClick={onReject} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
            Reject
          </button>
        </div>
      </div>
    </div>
  );
};

export default Popup;