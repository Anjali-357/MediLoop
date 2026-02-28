import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function PainHistory({ patientId }) {
    const [data, setData] = useState([]);

    useEffect(() => {
        fetch(`http://localhost:8000/api/painscan/history/${patientId}`)
            .then(res => res.json())
            .then(json => {
                if (json.success && json.data) {
                    const formatted = json.data.map(d => ({
                        time: new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        score: d.score,
                        hr: d.heart_rate,
                        rr: d.resp_rate
                    })).reverse();
                    setData(formatted);
                }
            })
            .catch(err => console.error(err));
    }, [patientId]);

    if (data.length === 0) return null;

    return (
        <div className="pain-history slide-up">
            <h3>Pain History</h3>
            <div className="chart-container">
                <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="time" tick={{ fill: '#888' }} />
                        <YAxis yAxisId="left" domain={[0, 10]} tick={{ fill: '#888' }} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 150]} tick={{ fill: '#888' }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Line yAxisId="left" type="monotone" name="Pain Score" dataKey="score" stroke="#4a90e2" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        <Line yAxisId="right" type="monotone" name="Heart Rate" dataKey="hr" stroke="#e74c3c" strokeWidth={2} dot={{ r: 3 }} />
                        <Line yAxisId="right" type="monotone" name="Resp Rate" dataKey="rr" stroke="#2ecc71" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
