// components/EEGPatientData.tsx
import React, { useState, useEffect } from 'react';
import { parse } from 'papaparse';

interface EEGData {
    eeg_id: string;
    eeg_sub_id: string;
    eeg_label_offset_seconds: string;
    spectrogram_id: string;
    spectrogram_sub_id: string;
    spectrogram_label_offset_seconds: string;
    label_id: string;
    patient_id: string;
    expert_consensus: string;
    seizure_vote: string;
    lpd_vote: string;
    gpd_vote: string;
    lrda_vote: string;
    grda_vote: string;
    other_vote: string;
}

const EEGPatientData: React.FC = () => {
    const [_eegData, setEEGData] = useState<EEGData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [groupedByPatient, setGroupedByPatient] = useState<Record<string, EEGData[]>>({});
    const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

    useEffect(() => {
        // In a real app, you'd fetch this data from an API
        // For demo purposes, we'll assume the CSV file is available at a specific URL
        fetch('/sample_data/sample_train.csv')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.text();
            })
            .then(csvText => {
                const { data, errors } = parse<EEGData>(csvText, {
                    header: true,
                    skipEmptyLines: true,
                });

                if (errors.length > 0) {
                    console.error('CSV parsing errors:', errors);
                }

                setEEGData(data);

                // Group by patient_id
                const grouped = data.reduce<Record<string, EEGData[]>>((acc, curr) => {
                    if (!curr.patient_id) return acc;

                    if (!acc[curr.patient_id]) {
                        acc[curr.patient_id] = [];
                    }

                    acc[curr.patient_id].push(curr);
                    return acc;
                }, {});

                setGroupedByPatient(grouped);
                setLoading(false);
            })
            .catch(error => {
                console.error('Error fetching CSV:', error);
                setError('Failed to load EEG data');
                setLoading(false);
            });
    }, []);

    const renderPatientList = () => {
        return (
            <div className="w-1/4 bg-gray-100 p-4 h-screen overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">Patients</h2>
                <div className="space-y-2">
                    {Object.keys(groupedByPatient).map(patientId => (
                        <button
                            key={patientId}
                            onClick={() => setSelectedPatient(patientId)}
                            className={`w-full text-left p-2 rounded ${
                                selectedPatient === patientId
                                    ? 'bg-blue-500 text-white'
                                    : 'hover:bg-gray-200'
                            }`}
                        >
                            Patient {patientId}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    const renderPatientData = () => {
        if (!selectedPatient) {
            return (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-gray-500">Select a patient to view their EEG data</p>
                </div>
            );
        }

        const patientData = groupedByPatient[selectedPatient];

        return (
            <div className="flex-1 p-6 overflow-y-auto">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold">Patient {selectedPatient}</h2>
                    <p className="text-gray-600">Total Records: {patientData.length}</p>
                </div>

                <div className="bg-white shadow-md rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EEG ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spectrogram ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Offset (sec)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expert Consensus</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Votes</th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {patientData.map((record, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.eeg_id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.spectrogram_id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.eeg_label_offset_seconds}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium
                      ${record.expert_consensus === 'Seizure' ? 'bg-red-100 text-red-800' :
                        record.expert_consensus === 'GRDA' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'}`
                    }>
                      {record.expert_consensus}
                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div className="flex space-x-2">
                                        {Number(record.seizure_vote) > 0 && (
                                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                          Seizure: {record.seizure_vote}
                        </span>
                                        )}
                                        {Number(record.lpd_vote) > 0 && (
                                            <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">
                          LPD: {record.lpd_vote}
                        </span>
                                        )}
                                        {Number(record.gpd_vote) > 0 && (
                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                          GPD: {record.gpd_vote}
                        </span>
                                        )}
                                        {Number(record.lrda_vote) > 0 && (
                                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                          LRDA: {record.lrda_vote}
                        </span>
                                        )}
                                        {Number(record.grda_vote) > 0 && (
                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          GRDA: {record.grda_vote}
                        </span>
                                        )}
                                        {Number(record.other_vote) > 0 && (
                                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                          Other: {record.other_vote}
                        </span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <strong className="font-bold">Error! </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen">
            {renderPatientList()}
            {renderPatientData()}
        </div>
    );
};

export default EEGPatientData;