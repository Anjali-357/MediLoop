import React from 'react';
import GapQueue from './GapQueue';
import AnalyticsDashboard from './AnalyticsDashboard';

export default function CareGapDashboard() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-8rem)]">
            <div className="lg:col-span-1 h-full bg-white p-6 rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <GapQueue />
            </div>
            <div className="lg:col-span-2 h-full flex flex-col space-y-6">
                <AnalyticsDashboard />
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex-1">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Module Insights</h2>
                    <p className="text-gray-600">
                        The Proactive Patient Outreach Engine scans patient records against 5 Care Gap Rules.
                        It integrates closely with Modules 1 and 2 to capture missed follow-ups and unaddressed deteriorations.
                        Select "Trigger Scan" manually to run the checks right now, or wait for the nightly automated jobs.
                    </p>
                </div>
            </div>
        </div>
    );
}
