import React from 'react';
import { Tag, CheckCircle2, Circle } from 'lucide-react';

const ICDSelector = ({ icdCodes, setIcdCodes, isGenerating }) => {
    const toggleCodeSelection = (index) => {
        const updated = [...icdCodes];
        updated[index] = {
            ...updated[index],
            selected: !updated[index].selected
        };
        setIcdCodes(updated);
    };

    if (isGenerating) {
        return (
            <div className="card p-6 min-h-[200px] flex flex-col items-center justify-center bg-white border border-surface-200">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-3"></div>
                <p className="text-sm text-surface-500">Mapping ICD-10 via Llama3...</p>
            </div>
        );
    }

    if (!icdCodes || icdCodes.length === 0) {
        return null; // Don't show if no codes
    }

    return (
        <div className="card bg-white border border-surface-200 overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-surface-100 bg-surface-50 flex items-center justify-between">
                <h2 className="text-lg font-bold text-surface-900 flex items-center">
                    <Tag className="w-5 h-5 mr-2 text-primary-500" />
                    ICD-10 Suggestions
                </h2>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                    Auto-mapped
                </span>
            </div>

            <div className="p-4 space-y-3 bg-white">
                {icdCodes.map((codeInfo, index) => {
                    const isSelected = codeInfo.selected !== false; // Default true
                    const confidenceColor = codeInfo.confidence > 0.85
                        ? 'text-emerald-600 bg-emerald-50 ring-emerald-500/20'
                        : 'text-amber-600 bg-amber-50 ring-amber-500/20';

                    return (
                        <div
                            key={index}
                            onClick={() => toggleCodeSelection(index)}
                            className={`flex items-start p-4 rounded-xl cursor-pointer transition-all duration-200 border ${isSelected
                                    ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500 shadow-sm'
                                    : 'border-surface-200 bg-white hover:border-primary-300'
                                }`}
                        >
                            <div className="mr-4 mt-0.5">
                                {isSelected ? (
                                    <CheckCircle2 className="w-5 h-5 text-primary-600" />
                                ) : (
                                    <Circle className="w-5 h-5 text-surface-300" />
                                )}
                            </div>

                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-surface-900">{codeInfo.code}</span>
                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${confidenceColor}`}>
                                        Math.round(codeInfo.confidence * 100)% Match
                                    </span>
                                </div>
                                <p className={`text-sm ${isSelected ? 'text-primary-900' : 'text-surface-600'}`}>
                                    {codeInfo.description}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ICDSelector;
