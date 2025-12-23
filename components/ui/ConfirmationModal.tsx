import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X, CheckCircle } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'default' | 'success';
    isLoading?: boolean;
    resultMessage?: string; // Shows result after action completes
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    isLoading = false,
    resultMessage
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const confirmButtonRef = useRef<HTMLButtonElement>(null);

    // Focus trap and escape key handler
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isLoading) {
                onClose();
            }
        };

        // Focus the confirm button when modal opens
        if (!resultMessage) {
            confirmButtonRef.current?.focus();
        }
        document.addEventListener('keydown', handleKeyDown);

        // Prevent body scroll
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose, isLoading, resultMessage]);

    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            icon: 'text-red-500',
            button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
            iconBg: 'bg-red-100 dark:bg-red-900/30'
        },
        warning: {
            icon: 'text-yellow-500',
            button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
            iconBg: 'bg-yellow-100 dark:bg-yellow-900/30'
        },
        default: {
            icon: 'text-primary-500',
            button: 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500',
            iconBg: 'bg-primary-100 dark:bg-primary-900/30'
        },
        success: {
            icon: 'text-green-500',
            button: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
            iconBg: 'bg-green-100 dark:bg-green-900/30'
        }
    };

    const styles = variantStyles[variant];

    // If we have a result message, show success state
    if (resultMessage) {
        return (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
                    onClick={onClose}
                />

                {/* Modal */}
                <div
                    ref={modalRef}
                    className="relative bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in border border-gray-200 dark:border-gray-700"
                >
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>

                    {/* Success Icon */}
                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                        <CheckCircle className="text-green-500" size={24} />
                    </div>

                    {/* Title */}
                    <h3
                        id="modal-title"
                        className="text-lg font-bold text-gray-900 dark:text-white mb-2"
                    >
                        Complete!
                    </h3>

                    {/* Result Message */}
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {resultMessage}
                    </p>

                    {/* Close Button Only */}
                    <button
                        onClick={onClose}
                        autoFocus
                        className="w-full px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-dark-800"
                    >
                        Done
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
                onClick={isLoading ? undefined : onClose}
            />

            {/* Modal */}
            <div
                ref={modalRef}
                className="relative bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in border border-gray-200 dark:border-gray-700"
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
                    aria-label="Close"
                >
                    <X size={20} />
                </button>

                {/* Icon */}
                <div className={`w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center mb-4`}>
                    <AlertTriangle className={styles.icon} size={24} />
                </div>

                {/* Title */}
                <h3
                    id="modal-title"
                    className="text-lg font-bold text-gray-900 dark:text-white mb-2"
                >
                    {title}
                </h3>

                {/* Message */}
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {message}
                </p>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        ref={confirmButtonRef}
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-dark-800 disabled:opacity-50 ${styles.button}`}
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processing...
                            </span>
                        ) : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
