import React, { useState } from 'react';
import { Send, X, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function PatientGapCard({ gap, onApprove, onDismiss }) {
    const [message, setMessage] = useState(gap.outreach_msg);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleApprove = async () => {
        setIsProcessing(true);
        await onApprove(gap.id || gap._id, message);
        setIsProcessing(false);
    };

    const handleDismiss = async () => {
        setIsProcessing(true);
        await onDismiss(gap.id || gap._id);
        setIsProcessing(false);
    };

    const priorityColors = {
        1: 'bg-red-100 text-red-800 border-red-200',
        2: 'bg-orange-100 text-orange-800 border-orange-200',
        3: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        4: 'bg-blue-100 text-blue-800 border-blue-200',
        5: 'bg-gray-100 text-gray-800 border-gray-200'
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 transition-all hover:shadow-md">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Patient ID: {gap.patient_id}</h3>
                    <p className="text-sm text-gray-500">Flagged: {new Date(gap.flagged_at).toLocaleString()}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${priorityColors[gap.priority] || priorityColors[5]}`}>
                    {gap.gap_type.replace(/_/g, ' ')}
                </span>
            </div>

            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    WhatsApp Draft Message
                </label>
                <textarea
                    rows={3}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                />
            </div>

            <div className="flex justify-end gap-2">
                <button
                    onClick={handleDismiss}
                    disabled={isProcessing}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    <X className="w-4 h-4 mr-1" />
                    Dismiss
                </button>
                <button
                    onClick={handleApprove}
                    disabled={isProcessing}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    <Send className="w-4 h-4 mr-2" />
                    Approve & Send
                </button>
            </div>
        </div>
    );
}
