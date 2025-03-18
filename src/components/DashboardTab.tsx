'use client';

import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

// Safe parsing function for votes (handles string values)
function parseVote(value) {
    if (value === undefined || value === null) return 0;
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(numValue) ? 0 : numValue;
}

// Calculate votes by grouping by spectrogram_id first to avoid duplication
function calculateVotes(records, voteType) {
    if (!records || !Array.isArray(records)) return 0;

    // Group records by spectrogram_id to prevent duplication of votes
    const spectrogramGroups = {};

    records.forEach((record) => {
        if (!record || !record.spectrogram_id) return;

        const spectrogramId = record.spectrogram_id;
        if (!spectrogramGroups[spectrogramId]) {
            spectrogramGroups[spectrogramId] = record;
        }
    });

    // Now calculate votes using only unique spectrograms
    return Object.values(spectrogramGroups).reduce((total, record) => {
        const voteKey = `${voteType}_vote`;
        if (record && voteKey in record) {
            return total + parseVote(record[voteKey]);
        }
        return total;
    }, 0);
}

// Calculate average offset time
function calculateAverageOffset(records) {
    if (!records || !Array.isArray(records) || records.length === 0) return 0;

    let totalOffset = 0;
    let validRecords = 0;

    records.forEach((record) => {
        if (record && 'eeg_label_offset_seconds' in record) {
            const offset = parseVote(record.eeg_label_offset_seconds);
            if (!isNaN(offset)) {
                totalOffset += offset;
                validRecords++;
            }
        }
    });

    return validRecords > 0 ? totalOffset / validRecords : 0;
}

// Calculate consensus distribution without duplicates
function calculateConsensusDistribution(records) {
    if (!records || !Array.isArray(records)) return {};

    // Group by spectrogram_id to avoid duplicates
    const spectrogramGroups = {};

    records.forEach((record) => {
        if (!record || !record.spectrogram_id) return;

        const spectrogramId = record.spectrogram_id;
        if (!spectrogramGroups[spectrogramId]) {
            spectrogramGroups[spectrogramId] = record;
        }
    });

    // Now calculate consensus distribution using unique spectrograms
    const distribution = {};
    const uniqueRecords = Object.values(spectrogramGroups);

    uniqueRecords.forEach((record) => {
        if (record && record.expert_consensus) {
            const consensus = record.expert_consensus;
            if (!distribution[consensus]) {
                distribution[consensus] = 0;
            }
            distribution[consensus]++;
        }
    });

    return { distribution, totalUniqueRecords: uniqueRecords.length };
}

const DashboardTab = ({ selectedPatient, patientCombinedRecords, dataSource }) => {
    // Guard against missing data
    if (!selectedPatient || !patientCombinedRecords || !Array.isArray(patientCombinedRecords)) {
        return (
            <div className='flex h-32 items-center justify-center'>
                <p className='text-muted-foreground'>No data available for this patient</p>
            </div>
        );
    }

    // Calculate patient statistics
    const totalRecords = patientCombinedRecords.length;
    const avgOffset = calculateAverageOffset(patientCombinedRecords);

    // Calculate consensus distribution (avoiding duplicates)
    const { distribution: consensusDistribution, totalUniqueRecords } =
        calculateConsensusDistribution(patientCombinedRecords);

    // Calculate vote distribution using the direct vote fields (avoiding duplicates)
    const voteDistribution = {
        seizure: calculateVotes(patientCombinedRecords, 'seizure'),
        lpd: calculateVotes(patientCombinedRecords, 'lpd'),
        gpd: calculateVotes(patientCombinedRecords, 'gpd'),
        lrda: calculateVotes(patientCombinedRecords, 'lrda'),
        grda: calculateVotes(patientCombinedRecords, 'grda'),
        other: calculateVotes(patientCombinedRecords, 'other')
    };

    // Calculate max vote value for progress bar scaling
    const maxVoteValue = Math.max(...Object.values(voteDistribution), 1);

    return (
        <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            {/* Patient Summary Card */}
            <Card>
                <CardHeader>
                    <CardTitle className='text-lg'>Patient Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className='space-y-4'>
                        <div>
                            <h3 className='text-muted-foreground mb-1 text-sm font-medium'>Total Records</h3>
                            <div className='text-3xl font-bold'>{totalRecords}</div>
                        </div>
                        <div>
                            <h3 className='text-muted-foreground mb-1 text-sm font-medium'>Unique Spectrograms</h3>
                            <div className='text-3xl font-bold'>{totalUniqueRecords}</div>
                        </div>
                        <div>
                            <h3 className='text-muted-foreground mb-1 text-sm font-medium'>Average Offset Time</h3>
                            <div className='text-xl'>{avgOffset.toFixed(1)}s</div>
                        </div>
                        <div>
                            <h3 className='text-muted-foreground mb-1 text-sm font-medium'>Consensus Distribution</h3>
                            <div className='space-y-2'>
                                {Object.entries(consensusDistribution).map(([type, count]) => (
                                    <div key={type} className='space-y-1'>
                                        <div className='flex justify-between text-sm'>
                                            <span>{type}</span>
                                            <span className='font-medium'>
                                                {count} ({Math.round((count / totalUniqueRecords) * 100)}%)
                                            </span>
                                        </div>
                                        <Progress value={(count / totalUniqueRecords) * 100} className='h-2' />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Vote Distribution Card */}
            <Card>
                <CardHeader>
                    <CardTitle className='text-lg'>Vote Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className='grid grid-cols-2 gap-4'>
                        {/* Seizure */}
                        <div className='rounded-md border p-3'>
                            <div className='text-muted-foreground text-sm'>Seizure</div>
                            <div className='mt-1 text-2xl font-bold'>{voteDistribution.seizure}</div>
                            <Progress value={voteDistribution.seizure} max={maxVoteValue} className='mt-2 h-1.5' />
                        </div>

                        {/* Lpd */}
                        <div className='rounded-md border p-3'>
                            <div className='text-muted-foreground text-sm'>Lpd</div>
                            <div className='mt-1 text-2xl font-bold'>{voteDistribution.lpd}</div>
                            <Progress value={voteDistribution.lpd} max={maxVoteValue} className='mt-2 h-1.5' />
                        </div>

                        {/* Gpd */}
                        <div className='rounded-md border p-3'>
                            <div className='text-muted-foreground text-sm'>Gpd</div>
                            <div className='mt-1 text-2xl font-bold'>{voteDistribution.gpd}</div>
                            <Progress value={voteDistribution.gpd} max={maxVoteValue} className='mt-2 h-1.5' />
                        </div>

                        {/* Lrda */}
                        <div className='rounded-md border p-3'>
                            <div className='text-muted-foreground text-sm'>Lrda</div>
                            <div className='mt-1 text-2xl font-bold'>{voteDistribution.lrda}</div>
                            <Progress value={voteDistribution.lrda} max={maxVoteValue} className='mt-2 h-1.5' />
                        </div>

                        {/* Grda */}
                        <div className='rounded-md border p-3'>
                            <div className='text-muted-foreground text-sm'>Grda</div>
                            <div className='mt-1 text-2xl font-bold'>{voteDistribution.grda}</div>
                            <Progress value={voteDistribution.grda} max={maxVoteValue} className='mt-2 h-1.5' />
                        </div>

                        {/* Other */}
                        <div className='rounded-md border p-3'>
                            <div className='text-muted-foreground text-sm'>Other</div>
                            <div className='mt-1 text-2xl font-bold'>{voteDistribution.other}</div>
                            <Progress value={voteDistribution.other} max={maxVoteValue} className='mt-2 h-1.5' />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Temporal Distribution Card */}
            <Card className='md:col-span-2'>
                <CardHeader>
                    <CardTitle className='text-lg'>Temporal Distribution of Anomalies</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className='flex h-64 items-center justify-center'>
                        <div className='text-muted-foreground'>
                            {dataSource === 'parquet'
                                ? 'Multi-channel data visualization would appear here'
                                : 'Temporal distribution graph would appear here'}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default DashboardTab;
