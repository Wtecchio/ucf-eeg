// This component can be used in your DashboardTab.jsx file
// to replace the placeholder for the Temporal Distribution of Anomalies section
import React, { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { AlertCircle } from 'lucide-react';

const TemporalDistribution = ({ patientCombinedRecords }) => {
    // Early return if no data
    if (!patientCombinedRecords || patientCombinedRecords.length === 0) {
        return (
            <Card className='md:col-span-2'>
                <CardHeader>
                    <CardTitle className='text-lg'>Temporal Distribution of Anomalies</CardTitle>
                </CardHeader>
                <CardContent className='flex h-64 items-center justify-center'>
                    <p className='text-muted-foreground'>No anomaly data available</p>
                </CardContent>
            </Card>
        );
    }

    // Group records by consensus type and sort them by offset
    const recordsByConsensus = useMemo(() => {
        const grouped = {};

        patientCombinedRecords.forEach((record) => {
            const consensus = record.expert_consensus;
            if (!grouped[consensus]) {
                grouped[consensus] = [];
            }

            // Use the offsets array if available, otherwise use the single offset
            if (record.offsets && record.offsets.length) {
                record.offsets.forEach((offset) => {
                    grouped[consensus].push({
                        ...record,
                        currentOffset: offset
                    });
                });
            } else {
                grouped[consensus].push({
                    ...record,
                    currentOffset: parseFloat(record.eeg_label_offset_seconds)
                });
            }
        });

        // Sort each group by offset
        Object.keys(grouped).forEach((key) => {
            grouped[key].sort((a, b) => a.currentOffset - b.currentOffset);
        });

        return grouped;
    }, [patientCombinedRecords]);

    // Get all offsets and find min/max to calculate the time range
    const allOffsets = patientCombinedRecords
        .flatMap((record) => record.offsets || [parseFloat(record.eeg_label_offset_seconds)])
        .filter((offset) => !isNaN(offset));

    const minOffset = Math.min(...allOffsets, 0);
    const maxOffset = Math.max(...allOffsets, 60); // Default to 60s if no data
    const timeRange = maxOffset - minOffset;

    // Anomaly type colors
    const consensusColors = {
        Seizure: 'bg-red-500',
        LPD: 'bg-orange-500',
        GPD: 'bg-yellow-500',
        LRDA: 'bg-green-500',
        GRDA: 'bg-amber-500',
        Other: 'bg-slate-500'
    };

    // Anomaly type badge variants
    const consensusBadgeVariants = {
        Seizure: 'destructive',
        LPD: 'default',
        GPD: 'outline',
        LRDA: 'secondary',
        GRDA: 'secondary',
        Other: 'outline'
    };

    // Calculate the position on the timeline
    const getPositionPercent = (offset) => {
        return ((offset - minOffset) / timeRange) * 100;
    };

    // Create time markers (every 5 seconds)
    const timeMarkers = [];
    const markerStep = Math.max(5, Math.ceil(timeRange / 10)); // At least 5s, but adjust for longer recordings
    for (let time = Math.floor(minOffset); time <= Math.ceil(maxOffset); time += markerStep) {
        timeMarkers.push(time);
    }

    return (
        <Card className='md:col-span-2'>
            <CardHeader>
                <CardTitle className='text-lg'>Temporal Distribution of Anomalies</CardTitle>
            </CardHeader>
            <CardContent>
                <div className='space-y-6'>
                    {/* Timeline container */}
                    <div className='relative h-64 w-full rounded-md border p-4'>
                        {/* Time axis */}
                        <div className='bg-border absolute right-0 bottom-8 left-0 h-px'></div>

                        {/* Time markers */}
                        {timeMarkers.map((time) => (
                            <div
                                key={time}
                                className='bg-border absolute bottom-6 h-2 w-px'
                                style={{ left: `${getPositionPercent(time)}%` }}>
                                <div className='text-muted-foreground absolute bottom-3 left-[-10px] w-20 text-center text-xs'>
                                    {time}s
                                </div>
                            </div>
                        ))}

                        {/* Anomaly type lanes */}
                        {Object.entries(recordsByConsensus).map(([consensus, records], laneIndex) => (
                            <div
                                key={consensus}
                                className='absolute right-0 left-0 flex h-6 items-center'
                                style={{ bottom: `${9 + laneIndex * 7}rem` }}>
                                {/* Lane label */}
                                <div className='absolute left-[-5px] w-16 text-right'>
                                    <Badge variant={consensusBadgeVariants[consensus] || 'outline'} className='text-xs'>
                                        {consensus}
                                    </Badge>
                                </div>

                                {/* Anomaly markers */}
                                {records.map((record, i) => (
                                    <div
                                        key={`${record.eeg_id}-${record.currentOffset}-${i}`}
                                        className={`absolute h-5 w-3 rounded-full ${consensusColors[consensus] || 'bg-slate-500'}`}
                                        style={{
                                            left: `${getPositionPercent(record.currentOffset)}%`,
                                            opacity: 0.8
                                        }}
                                        title={`${consensus} at ${record.currentOffset.toFixed(1)}s`}
                                    />
                                ))}

                                {/* Density graph - show concentration of anomalies */}
                                <div className='absolute right-0 bottom-[-20px] left-0 h-3'>
                                    {records.length > 3 && (
                                        <div className='relative h-full w-full'>
                                            {Array.from({ length: 100 }).map((_, index) => {
                                                // For each percentage point of the timeline, count nearby anomalies
                                                const position = (index / 100) * timeRange + minOffset;
                                                const nearbyCount = records.filter(
                                                    (r) => Math.abs(r.currentOffset - position) < timeRange / 20
                                                ).length;

                                                // Calculate height based on density
                                                const height = Math.min(100, (nearbyCount / records.length) * 300);

                                                return (
                                                    <div
                                                        key={index}
                                                        className={`absolute bottom-0 w-[1px] ${consensusColors[consensus] || 'bg-slate-500'}`}
                                                        style={{
                                                            left: `${index}%`,
                                                            height: `${height}%`,
                                                            opacity: Math.min(0.7, 0.1 + nearbyCount / records.length)
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Count & statistics summary */}
                        <div className='absolute top-2 right-2 text-right'>
                            <div className='text-sm font-medium'>
                                {Object.entries(recordsByConsensus).reduce(
                                    (sum, [_, records]) => sum + records.length,
                                    0
                                )}{' '}
                                Anomalies
                            </div>
                            <div className='text-muted-foreground text-xs'>{timeRange.toFixed(1)}s time span</div>
                        </div>

                        {/* Pattern indicator */}
                        {Object.values(recordsByConsensus).some((records) => records.length >= 3) && (
                            <div className='bg-muted/60 absolute top-2 left-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs'>
                                <AlertCircle className='h-3 w-3' />
                                <span>
                                    {Object.entries(recordsByConsensus)
                                        .filter(([_, records]) => records.length >= 3)
                                        .map(([consensus]) => consensus)
                                        .join(', ')}{' '}
                                    pattern detected
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Legend */}
                    <div className='flex flex-wrap justify-center gap-4'>
                        {Object.entries(consensusColors).map(([type, color]) =>
                            recordsByConsensus[type] && recordsByConsensus[type].length > 0 ? (
                                <div key={type} className='flex items-center gap-2'>
                                    <div className={`h-3 w-3 rounded-full ${color}`}></div>
                                    <div className='text-xs'>
                                        <span className='font-medium'>{type}</span>
                                        <span className='text-muted-foreground'>
                                            {' '}
                                            ({recordsByConsensus[type].length})
                                        </span>
                                    </div>
                                </div>
                            ) : null
                        )}
                    </div>

                    {/* Key statistics */}
                    <div className='grid grid-cols-3 gap-4'>
                        {Object.entries(recordsByConsensus).map(([consensus, records]) => {
                            if (records.length < 2) return null;

                            // Calculate interval statistics
                            const intervals = [];
                            for (let i = 1; i < records.length; i++) {
                                intervals.push(records[i].currentOffset - records[i - 1].currentOffset);
                            }

                            const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
                            const minInterval = Math.min(...intervals);
                            const maxInterval = Math.max(...intervals);

                            return (
                                <div key={consensus} className='rounded-md border p-3'>
                                    <div className='flex items-center gap-2'>
                                        <div className={`h-3 w-3 rounded-full ${consensusColors[consensus]}`}></div>
                                        <div className='font-medium'>{consensus}</div>
                                    </div>
                                    <div className='text-muted-foreground mt-2 space-y-1 text-xs'>
                                        <div>Avg. interval: {avgInterval.toFixed(1)}s</div>
                                        <div>
                                            Range: {minInterval.toFixed(1)}s - {maxInterval.toFixed(1)}s
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default TemporalDistribution;
