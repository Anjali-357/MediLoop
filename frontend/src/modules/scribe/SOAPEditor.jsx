import React from 'react';

const SOAPEditor = ({ soapData, setSoapData, isGenerating }) => {
    const handleChange = (section, value) => {
        setSoapData(prev => ({
            ...prev,
            [section]: value
        }));
    };

    const sections = [
        { id: 'subjective', label: 'Subjective (S)' },
        { id: 'objective', label: 'Objective (O)' },
        { id: 'assessment', label: 'Assessment (A)' },
        { id: 'plan', label: 'Plan (P)' },
    ];

    if (isGenerating) {
        return (
            <div className="card p-6 h-full flex flex-col items-center justify-center bg-white border border-surface-200 min-h-[400px]">
                <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
                <h3 className="text-lg font-medium text-surface-900">Synthesizing Consultation...</h3>
                <p className="text-sm text-surface-500 mt-2">Gemini is structuring the SOAP note</p>
            </div>
        );
    }

    return (
        <div className="card h-full bg-white border border-surface-200 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-100 bg-surface-50">
                <h2 className="text-lg font-bold text-surface-900">Structured Note</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {sections.map((section) => (
                    <div key={section.id}>
                        <label className="block text-sm font-semibold text-surface-700 mb-2">
                            {section.label}
                        </label>
                        <textarea
                            className="w-full rounded-lg border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-surface-800 p-3 ring-1 ring-inset ring-surface-200 bg-surface-50/50"
                            rows={4}
                            value={soapData[section.id] || ''}
                            onChange={(e) => handleChange(section.id, e.target.value)}
                            placeholder={`Enter ${section.id} details here...`}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SOAPEditor;
