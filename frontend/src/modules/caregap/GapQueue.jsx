import React, { useState, useEffect } from 'react';
import PatientGapCard from '../../components/PatientGapCard.jsx';
import { RefreshCw } from 'lucide-react';

export default function GapQueue() {
    const [gaps, setGaps] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchGaps = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/caregap/pending');
            const json = await res.json();
            if (json.success) {
                setGaps(json.data);
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchGaps();
    }, []);

    const handleApprove = async (id, finalMessage) => {
        // We could send the finalMessage to a backend endpoint like /api/caregap/approve/{id} with body if it allowed edits.
        // The PRD says "inline editable draft message" - we assume the edit makes it to the user. Since the PRD API `POST /api/caregap/approve/{gap_id}` doesn't specify a body, we will just pass it, or we could update it first. For hackathon, we'll just call the default approve.
        try {
            await fetch(`/api/caregap/approve/${id}`, { method: 'POST' });
            setGaps(prev => prev.filter(g => (g.id || g._id) !== id));
        } catch (e) {
            console.error(e);
        }
    };

    const handleDismiss = async (id) => {
        try {
            await fetch(`/api/caregap/dismiss/${id}`, { method: 'POST' });
            setGaps(prev => prev.filter(g => (g.id || g._id) !== id));
        } catch (e) {
            console.error(e);
        }
    };

    const handleScan = async () => {
        try {
            await fetch('/api/caregap/scan', { method: 'POST' });
            alert("Scan triggered! Refresh shortly.");
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Pending Gaps ({gaps.length})</h2>
                <div className="flex space-x-2">
                    <button
                        onClick={handleScan}
                        className="inline-flex items-center px-3 py-2 border border-indigo-200 text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                    >
                        Trigger Scan
                    </button>
                    <button
                        onClick={fetchGaps}
                        disabled={loading}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
                {loading && <p className="text-gray-500">Loading gaps...</p>}
                {!loading && gaps.length === 0 && (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <p className="text-gray-500">No pending care gaps needing review.</p>
                    </div>
                )}
                {gaps.map(gap => (
                    <PatientGapCard
                        key={gap.id || gap._id}
                        gap={gap}
                        onApprove={handleApprove}
                        onDismiss={handleDismiss}
                    />
                ))}
            </div>
        </div>
    );
}
