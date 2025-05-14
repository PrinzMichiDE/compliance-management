'use client';

import React from 'react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  itemName?: string; // Name des zu löschenden Elements, z.B. Regelname oder ID
  isDeleting?: boolean; // Um den Bestätigungsbutton während des Löschens zu deaktivieren
  title?: string;
  message?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemName = 'dieses Element',
  isDeleting = false,
  title = 'Löschen bestätigen',
  message,
  confirmButtonText = 'Löschen bestätigen',
  cancelButtonText = 'Abbrechen',
}) => {
  if (!isOpen) {
    return null;
  }

  const defaultMessage = `Möchten Sie ${itemName} wirklich unwiderruflich löschen?`;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center px-4">
      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-md mx-auto">
        <h3 className="text-lg font-medium leading-6 text-gray-900">{title}</h3>
        <div className="mt-2">
          <p className="text-sm text-gray-500">
            {message || defaultMessage}
          </p>
        </div>
        <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button
            type="button"
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm disabled:opacity-50"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Wird gelöscht...' : confirmButtonText}
          </button>
          <button
            type="button"
            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm disabled:opacity-50"
            onClick={onClose}
            disabled={isDeleting}
          >
            {cancelButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal; 