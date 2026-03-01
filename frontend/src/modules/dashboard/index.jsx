import React, { useState, useEffect, useContext } from 'react';
import { Users, Filter, Search, Activity, Phone, MonitorSmartphone } from 'lucide-react';
import { AppContext } from '../../context/AppContext';

const DashboardModule = () => {
    const { currentDoctor } = useContext(AppContext);
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedRows, setExpandedRows] = useState(new Set());

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:8000/api/identity/patients/dashboard');
            const result = await response.json();

            if (response.ok && result.success) {
                setPatients(result.data);
            } else {
                throw new Error(result.message || 'Failed to fetch patients');
            }
        } catch (err) {
            console.error("Dashboard fetch error:", err);
            setError("Could not load patient insights.");
        } finally {
            setLoading(false);
        }
    };

    const filteredPatients = patients.filter(pt =>
        pt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pt.phone.includes(searchTerm)
    );

    const formatTimestamp = (isoString) => {
        if (!isoString) return 'Never';
        const date = new Date(isoString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const toggleRow = (id) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center p-12">
                <div className="flex flex-col items-center">
                    <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
                    <p className="text-surface-600 font-medium">Loading Patient Directory...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8">
                <div className="bg-red-50 text-red-600 p-4 rounded-xl shadow-sm border border-red-100 flex items-center">
                    <Activity className="w-5 h-5 mr-2" />
                    <span className="font-medium">{error}</span>
                    <button onClick={fetchPatients} className="ml-auto bg-white px-3 py-1 rounded border border-red-200 text-sm hover:bg-red-50">Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col space-y-6">

            {/* Header Banner */}
            <div className="bg-white rounded-xl shadow-sm border border-surface-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900 flex items-center">
                        <Users className="w-7 h-7 mr-3 text-primary-600" />
                        Patient Insights Dashboard
                    </h1>
                    <p className="text-surface-500 mt-1">High-level overview of mapped MediLoop patients in MongoDB</p>
                </div>

                <div className="flex bg-surface-50 p-3 rounded-lg border border-surface-200 items-center">
                    <div className="bg-white p-2 rounded shadow-sm mr-3">
                        <MonitorSmartphone className="w-5 h-5 text-surface-400" />
                    </div>
                    <div>
                        <p className="text-xs text-surface-500 font-medium uppercase tracking-wider">Total Active</p>
                        <p className="text-lg font-bold text-surface-900 leading-none mt-1">{patients.length}</p>
                    </div>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-surface-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-surface-300 rounded-lg leading-5 bg-white placeholder-surface-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm shadow-sm transition-colors"
                        placeholder="Search by name or phone number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center space-x-2">
                    <button className="btn-secondary rounded-lg px-3 py-2 text-sm shadow-sm">
                        <Filter className="w-4 h-4 mr-2 inline-block" />
                        Filter Directory
                    </button>
                </div>
            </div>

            {/* Patient Grid/Table */}
            <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden flex-1">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-surface-200">
                        <thead className="bg-surface-50 sticky top-0">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">
                                    Patient Profile
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">
                                    Metrics
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">
                                    Identity Source
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">
                                    Last Active
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th scope="col" className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-surface-100">
                            {filteredPatients.length > 0 ? (
                                filteredPatients.map((pt) => {
                                    // Status pill styling
                                    let statusColor = "bg-surface-100 text-surface-800 ring-surface-500/10";
                                    if (pt.onboarding_status === 'completed') statusColor = "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
                                    else if (pt.onboarding_status === 'pending') statusColor = "bg-amber-50 text-amber-700 ring-amber-600/20";

                                    return (
                                        <React.Fragment key={pt._id}>
                                            <tr onClick={() => toggleRow(pt._id)} className="hover:bg-primary-50/50 transition-colors cursor-pointer">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center border border-primary-300">
                                                            <span className="text-primary-800 font-bold text-sm">
                                                                {pt.name.charAt(0).toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <div className="ml-4">
                                                            <div className="text-sm font-semibold text-surface-900">{pt.name}</div>
                                                            <div className="text-sm text-surface-500 flex items-center mt-0.5">
                                                                <Phone className="w-3 h-3 mr-1" />
                                                                {pt.phone}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-surface-900">Age: {pt.age}</div>
                                                    <div className="text-sm text-surface-500">{pt.language}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-surface-900 capitalize font-medium">
                                                        {pt.source ? pt.source.replace('_', ' ') : 'Unknown'}
                                                    </div>
                                                    <div className="text-sm text-surface-500 mt-0.5">
                                                        WhatsApp Opt-in: {pt.whatsapp_opt_in ? 'Yes' : 'No'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-600">
                                                    {formatTimestamp(pt.last_active_at)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusColor} capitalize`}>
                                                        {pt.onboarding_status || 'Unknown'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <svg className={`w-5 h-5 text-surface-400 transition-transform ${expandedRows.has(pt._id) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </td>
                                            </tr>
                                            {expandedRows.has(pt._id) && pt.insights && (
                                                <tr className="bg-surface-50 border-b border-surface-200">
                                                    <td colSpan="6" className="px-8 py-6">
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                            {/* Clinical Documentation */}
                                                            <div className="bg-white p-4 border border-surface-200 rounded-lg shadow-sm">
                                                                <h4 className="text-sm font-bold text-surface-900 mb-3 border-b border-surface-100 pb-2">Latest Consultation (SOAP)</h4>
                                                                {pt.insights.latest_consultation && pt.insights.latest_consultation.soap_note ? (
                                                                    <div className="space-y-2 text-sm text-surface-700">
                                                                        <p><strong className="text-surface-900">Assessment:</strong> {pt.insights.latest_consultation.soap_note.assessment}</p>
                                                                        <p><strong className="text-surface-900">Plan:</strong> {pt.insights.latest_consultation.soap_note.plan}</p>
                                                                        <p className="text-xs text-surface-400 mt-2">{formatTimestamp(pt.insights.latest_consultation.created_at)}</p>
                                                                    </div>
                                                                ) : <p className="text-sm text-surface-500 italic">No clinical documentation available.</p>}
                                                            </div>

                                                            {/* Active Alerts (RecoverBot) */}
                                                            <div className="bg-white p-4 border border-red-100 rounded-lg shadow-sm">
                                                                <h4 className="text-sm font-bold text-red-700 mb-3 border-b border-red-50 pb-2">RecoverBot Risk Alert</h4>
                                                                {pt.insights.latest_followup ? (
                                                                    <div className="space-y-2 text-sm">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${pt.insights.latest_followup.risk_label === 'CRITICAL' ? 'bg-red-600 text-white' : pt.insights.latest_followup.risk_label === 'HIGH' ? 'bg-orange-500 text-white' : 'bg-green-100 text-green-800'}`}>
                                                                                {pt.insights.latest_followup.risk_label} RISK
                                                                            </span>
                                                                            <span className="text-surface-600 font-medium tracking-wide">Score: {pt.insights.latest_followup.risk_score}</span>
                                                                        </div>
                                                                        <p className="text-surface-700 mt-1 capitalize">Status: {pt.insights.latest_followup.status}</p>
                                                                        <p className="text-xs text-surface-400 mt-2">{formatTimestamp(pt.insights.latest_followup.created_at)}</p>
                                                                    </div>
                                                                ) : <p className="text-sm text-surface-500 italic">No active post-op followups.</p>}
                                                            </div>

                                                            {/* Pending Actions (Care Gaps) */}
                                                            <div className="bg-white p-4 border border-amber-100 rounded-lg shadow-sm">
                                                                <h4 className="text-sm font-bold text-amber-700 mb-3 border-b border-amber-50 pb-2">Pending Care Gaps</h4>
                                                                {pt.insights.pending_care_gaps && pt.insights.pending_care_gaps.length > 0 ? (
                                                                    <ul className="space-y-3">
                                                                        {pt.insights.pending_care_gaps.map(gap => (
                                                                            <li key={gap._id} className="text-sm">
                                                                                <p className="font-semibold text-surface-900 capitalize">{gap.gap_type.replace('_', ' ')}</p>
                                                                                <p className="text-surface-600 truncate mt-0.5" title={gap.outreach_msg}>"{gap.outreach_msg}"</p>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                ) : <p className="text-sm text-surface-500 italic">Patient is compliant.</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center">
                                        <Users className="mx-auto h-12 w-12 text-surface-300 mb-3" />
                                        <p className="text-surface-500 font-medium">No patient records found matching your query.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DashboardModule;
