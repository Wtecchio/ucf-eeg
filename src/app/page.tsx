import React from 'react';
import EEGPatientData from '@/components/EEGPatientData';

const PatientsPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                    <h1 className="text-3xl font-bold text-gray-900">EEG Patient Data</h1>
                </div>
            </header>
            <main>
                <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                    <EEGPatientData />
                </div>
            </main>
        </div>
    );
};

export default PatientsPage;
