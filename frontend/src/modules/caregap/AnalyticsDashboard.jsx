import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AnalyticsDashboard() {
    const [data, setData] = useState([]);

    useEffect(() => {
        async function fetchAnalytics() {
            try {
                const res = await fetch('http://localhost:8000/api/caregap/analytics');
                const json = await res.json();
                if (json.success) {
                    const formatted = Object.keys(json.data).map(type => ({
                        name: type.replace(/_/g, ' '),
                        Pending: json.data[type].pending || 0,
                        Sent: json.data[type].sent || 0,
                        Dismissed: json.data[type].dismissed || 0,
                    }));
                    setData(formatted);
                }
            } catch (e) {
                console.error(e);
            }
        }
        fetchAnalytics();
        const interval = setInterval(fetchAnalytics, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Outreach Analytics</h2>

            <div className="h-80 w-full mb-6 relative">
                {data.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                        No data available yet
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="Pending" stackId="a" fill="#f59e0b" />
                            <Bar dataKey="Sent" stackId="a" fill="#10b981" />
                            <Bar dataKey="Dismissed" stackId="a" fill="#6b7280" />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="bg-yellow-50 p-4 rounded border border-yellow-100">
                    <p className="text-sm font-medium text-yellow-800">Total Pending</p>
                    <p className="text-2xl font-bold text-yellow-900">
                        {data.reduce((acc, curr) => acc + curr.Pending, 0)}
                    </p>
                </div>
                <div className="bg-green-50 p-4 rounded border border-green-100">
                    <p className="text-sm font-medium text-green-800">Total Sent</p>
                    <p className="text-2xl font-bold text-green-900">
                        {data.reduce((acc, curr) => acc + curr.Sent, 0)}
                    </p>
                </div>
                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                    <p className="text-sm font-medium text-gray-700">Total Dismissed</p>
                    <p className="text-2xl font-bold text-gray-900">
                        {data.reduce((acc, curr) => acc + curr.Dismissed, 0)}
                    </p>
                </div>
            </div>
        </div>
    );
}
