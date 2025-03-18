'use client';

import { useEffect, useState } from 'react';

import Papa from 'papaparse';

// Types
export interface EEGData {
    eeg_id: string;
    eeg_sub_id?: string;
    eeg_label_offset_seconds: string;
    spectrogram_id: string;
    spectrogram_sub_id?: string;
    spectrogram_label_offset_seconds?: string;
    label_id?: string;
    patient_id?: string;
    expert_consensus: string;
    seizure_vote?: string;
    lpd_vote?: string;
    gpd_vote?: string;
    lrda_vote?: string;
    grda_vote?: string;
    other_vote?: string;
}

export interface ParsedEEGData {
    data: number[][][]; // [channels][timepoints][features] for EEG or [channels][frequencies][timepoints] for spectrograms
    metadata: {
        recordId?: string;
        patientId?: string;
        channelNames?: string[];
        samplingRate?: number;
        timePoints?: number;
        frequencies?: number[];
    };
}

export interface SpectrogramData {
    patientId: string;
    eegId: string;
    data: number[][];
    channelNames?: string[];
    frequencies?: number[];
    timePoints?: number[];
}

// Function to fetch CSV data from URL
export async function fetchCSVFromURL(url: string): Promise<EEGData[]> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV from ${url}: ${response.status} ${response.statusText}`);
        }
        const csvText = await response.text();
        return parseCSV(csvText);
    } catch (error) {
        console.error('Error fetching CSV:', error);
        return [];
    }
}

// Parse CSV text into EEGData records
export async function parseCSV(text: string): Promise<EEGData[]> {
    return new Promise((resolve, reject) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors && results.errors.length > 0) {
                    console.warn('CSV parsing had errors:', results.errors);
                }

                const records: EEGData[] = results.data.map((row: any) => ({
                    eeg_id: row.eeg_id || '',
                    eeg_sub_id: row.eeg_sub_id || '',
                    eeg_label_offset_seconds: row.eeg_label_offset_seconds || '0',
                    spectrogram_id: row.spectrogram_id || '',
                    spectrogram_sub_id: row.spectrogram_sub_id || '',
                    spectrogram_label_offset_seconds: row.spectrogram_label_offset_seconds || '0',
                    label_id: row.label_id || '',
                    patient_id: row.patient_id || '',
                    expert_consensus: row.expert_consensus || 'Unknown',
                    seizure_vote: row.seizure_vote || '0',
                    lpd_vote: row.lpd_vote || '0',
                    gpd_vote: row.gpd_vote || '0',
                    lrda_vote: row.lrda_vote || '0',
                    grda_vote: row.grda_vote || '0',
                    other_vote: row.other_vote || '0'
                }));
                resolve(records);
            },
            error: (error) => {
                reject(error);
            }
        });
    });
}

// Function to load EEG data by ID
export async function loadEEGById(eegId: string): Promise<ParsedEEGData | null> {
    try {
        const eegPath = `/sample_data/eegs/${eegId}.parquet`;

        // First check if the file exists with a HEAD request
        try {
            const headResponse = await fetch(eegPath, { method: 'HEAD' });
            if (!headResponse.ok) {
                console.warn(`EEG file not found: ${eegPath}`);
                return null;
            }
        } catch (err) {
            console.warn(`Error checking EEG file: ${eegPath}`, err);
            return null;
        }

        // Then actually fetch the file
        const response = await fetch(eegPath);
        if (!response.ok) {
            throw new Error(`Failed to fetch EEG data for ${eegId}`);
        }

        // For non-browser environments, you would use a parquet library here
        // Since browsers don't natively support parquet parsing, we'll use a placeholder
        // and parse the raw ArrayBuffer in a real implementation

        // In a real implementation, you would have code like this:
        // const buffer = await response.arrayBuffer();
        // const result = await parquet.parseEEG(buffer);

        // For now, we'll create placeholder EEG data based on the example you provided
        const rawData = await response.arrayBuffer();
        console.log(`Loaded EEG parquet file for ${eegId}, size: ${rawData.byteLength} bytes`);

        // In a production environment, you would use Arrow.js or another library to parse the parquet file
        // For now, we'll create a mock EEG dataset that resembles the structure of your example
        const channelNames = [
            'Fp1',
            'F3',
            'C3',
            'P3',
            'F7',
            'T3',
            'T5',
            'O1',
            'Fz',
            'Cz',
            'Pz',
            'Fp2',
            'F4',
            'C4',
            'P4',
            'F8',
            'T4',
            'T6',
            'O2',
            'EKG'
        ];
        const timePoints = 1000; // Placeholder - would be parsed from the file

        // Create a mock dataset with the correct structure
        const mockEEGData: number[][][] = [];

        // For each channel, create a time series
        for (let c = 0; c < channelNames.length; c++) {
            const channelData: number[][] = [];
            // Each timepoint has a single value for EEG
            for (let t = 0; t < timePoints; t++) {
                // Use the eegId as part of the seed for more varied but deterministic random values
                const seed = (parseInt(eegId.substring(0, 5) || '0', 10) + c * 100 + t) % 1000;
                const randomValue = Math.sin(seed / 50) * 20 + (Math.random() - 0.5) * 10;
                channelData.push([randomValue]);
            }
            mockEEGData.push(channelData);
        }

        // Return structured EEG data
        return {
            data: mockEEGData,
            metadata: {
                recordId: eegId,
                patientId: '', // Would be filled from metadata
                channelNames: channelNames,
                samplingRate: 256, // Common EEG sampling rate
                timePoints: timePoints
            }
        };
    } catch (error) {
        console.error(`Error loading EEG data for ${eegId}:`, error);
        return null;
    }
}

// Function to load spectrogram data by ID
export async function loadSpectrogramById(spectrogramId: string): Promise<ParsedEEGData | null> {
    try {
        const spectrogramPath = `/sample_data/spectrograms/${spectrogramId}.parquet`;

        // First check if the file exists
        try {
            const headResponse = await fetch(spectrogramPath, { method: 'HEAD' });
            if (!headResponse.ok) {
                console.warn(`Spectrogram file not found: ${spectrogramPath}`);
                return null;
            }
        } catch (err) {
            console.warn(`Error checking spectrogram file: ${spectrogramPath}`, err);
            return null;
        }

        // Then fetch the file
        const response = await fetch(spectrogramPath);
        if (!response.ok) {
            throw new Error(`Failed to fetch spectrogram for ${spectrogramId}`);
        }

        const rawData = await response.arrayBuffer();
        console.log(`Loaded spectrogram parquet file for ${spectrogramId}, size: ${rawData.byteLength} bytes`);

        // In a production environment, you would parse the parquet file
        // For now, we'll create a mock dataset based on your example

        // From your example, spectrogram data has this format:
        // columns like LL_0.59, LL_0.78, etc. (channel_frequency)

        // Parse out channel names and frequencies from your example
        const channelNames = ['LL', 'RL', 'LP', 'RP'];

        // Create frequency array based on the example (from 0.59 Hz to 19.92 Hz)
        const frequencies: number[] = [];
        for (let f = 0.5; f < 20; f += 0.2) {
            frequencies.push(parseFloat(f.toFixed(2)));
        }

        // Mock time points from 1 to 30 (similar to your example)
        const timePoints = 30;

        // Create a mock spectrogram dataset with the correct structure
        const mockSpectrogramData: number[][][] = [];

        // For each channel, create a frequency x time matrix
        for (let c = 0; c < channelNames.length; c++) {
            const channelData: number[][] = [];

            // For each frequency, create a time series
            for (let f = 0; f < frequencies.length; f++) {
                const freqTimeData: number[] = [];

                // For each time point, create a value
                for (let t = 0; t < timePoints; t++) {
                    // Use spectrogramId as part of the seed for deterministic random values
                    const seed = (parseInt(spectrogramId.substring(0, 5) || '0', 10) + c * 1000 + f * 100 + t) % 1000;

                    // Create a more realistic spectrogram pattern
                    // Low frequency has higher magnitude, decreasing as frequency increases
                    const freqFactor = Math.max(0.2, 1 - f / frequencies.length);

                    // Create some time-based patterns
                    const timeFactor = 0.5 + 0.5 * Math.sin(t / 10 + seed / 100);

                    // Combine factors with some randomness
                    const value = freqFactor * timeFactor * (5 + 5 * Math.random());
                    freqTimeData.push(value);
                }

                channelData.push(freqTimeData);
            }

            mockSpectrogramData.push(channelData);
        }

        // Return structured spectrogram data
        return {
            data: mockSpectrogramData,
            metadata: {
                recordId: spectrogramId,
                patientId: '', // Would be filled from metadata
                channelNames: channelNames,
                frequencies: frequencies,
                timePoints: timePoints
            }
        };
    } catch (error) {
        console.error(`Error loading spectrogram data for ${spectrogramId}:`, error);
        return null;
    }
}

// Parse Parquet array buffer to EEG data
export async function parseEEGParquet(buffer: ArrayBuffer): Promise<ParsedEEGData> {
    console.log('Parsing EEG parquet buffer of size:', buffer.byteLength);

    // In a real implementation, you would use a parquet parsing library here
    // For demonstration, we'll create a mock structure

    const channelNames = [
        'Fp1',
        'F3',
        'C3',
        'P3',
        'F7',
        'T3',
        'T5',
        'O1',
        'Fz',
        'Cz',
        'Pz',
        'Fp2',
        'F4',
        'C4',
        'P4',
        'F8',
        'T4',
        'T6',
        'O2',
        'EKG'
    ];
    const timePoints = 1000;

    // Create a mock dataset with the correct structure
    const mockEEGData: number[][][] = [];

    // Generate deterministic data based on buffer size for consistency
    const seed = buffer.byteLength;

    for (let c = 0; c < channelNames.length; c++) {
        const channelData: number[][] = [];
        for (let t = 0; t < timePoints; t++) {
            // Use a deterministic "random" function
            const value = Math.sin((seed + c * 100 + t) / 50) * 20;
            channelData.push([value]);
        }
        mockEEGData.push(channelData);
    }

    return {
        data: mockEEGData,
        metadata: {
            recordId: `PARQUET-${seed % 10000}`,
            patientId: `P${(seed % 1000).toString().padStart(3, '0')}`,
            channelNames: channelNames,
            samplingRate: 256
        }
    };
}

// Get matching EEG and spectrogram pairs
export async function getMatchedEEGSpectrogramPairs(): Promise<
    { eegId: string; spectrogramId: string; patientId: string }[]
> {
    try {
        // Fetch CSV data that has the mapping between EEG and spectrogram IDs
        const response = await fetch('/sample_data/sample_train.csv');
        if (!response.ok) {
            throw new Error('Failed to load CSV mapping file');
        }

        const csvText = await response.text();
        const records = await parseCSV(csvText);

        // Extract unique EEG-Spectrogram pairs
        const pairs = new Map<string, { eegId: string; spectrogramId: string; patientId: string }>();

        records.forEach((record) => {
            const key = `${record.eeg_id}|${record.spectrogram_id}`;
            if (!pairs.has(key) && record.eeg_id && record.spectrogram_id) {
                pairs.set(key, {
                    eegId: record.eeg_id,
                    spectrogramId: record.spectrogram_id,
                    patientId: record.patient_id || 'unknown'
                });
            }
        });

        return Array.from(pairs.values());
    } catch (error) {
        console.error('Error getting matched EEG-Spectrogram pairs:', error);
        return [];
    }
}

// Function to generate mock spectrogram data (for visualization without actual parquet files)
export function generateSpectrogramData(patientId: string, eegId: string): SpectrogramData {
    // Create a deterministic seed based on the IDs
    const seed = `${patientId}${eegId}`.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);

    // Generate 4 channels x 20 timepoints of spectrogram data
    const data: number[][] = [];

    for (let channel = 0; channel < 4; channel++) {
        const channelData: number[] = [];
        for (let t = 0; t < 20; t++) {
            // Create a pseudo-random value based on seed, channel, and timepoint
            const pseudoRandom = Math.sin(seed + channel * 10 + t) * 0.5 + 0.5;
            channelData.push(pseudoRandom * 10); // Scale to 0-10 range
        }
        data.push(channelData);
    }

    return {
        patientId,
        eegId,
        data,
        channelNames: ['LL', 'RL', 'LP', 'RP'],
        frequencies: Array.from({ length: 20 }, (_, i) => i * 0.5 + 0.5), // 0.5 Hz to 10 Hz
        timePoints: Array.from({ length: 20 }, (_, i) => i) // 0 to 19
    };
}

// Custom hook for loading EEG and spectrogram data
export function useEEGSpectrogramData(eegId?: string, spectrogramId?: string) {
    const [eegData, setEEGData] = useState<ParsedEEGData | null>(null);
    const [spectrogramData, setSpectrogramData] = useState<ParsedEEGData | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            if (!eegId && !spectrogramId) return;

            setLoading(true);
            setError(null);

            try {
                // Load EEG data if eegId is provided
                if (eegId) {
                    const eegResult = await loadEEGById(eegId);
                    setEEGData(eegResult);
                }

                // Load spectrogram data if spectrogramId is provided
                if (spectrogramId) {
                    const spectrogramResult = await loadSpectrogramById(spectrogramId);
                    setSpectrogramData(spectrogramResult);
                }
            } catch (err) {
                console.error('Error loading EEG or spectrogram data:', err);
                setError('Failed to load data. Please check the console for details.');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [eegId, spectrogramId]);

    return { eegData, spectrogramData, loading, error };
}

// Combine EEG records by offset time
export function combineRecordsByOffset(records: EEGData[]): EEGData[] {
    if (!records || !Array.isArray(records) || records.length === 0) {
        return [];
    }

    // Group records by (patient_id, eeg_id, spectrogram_id, offset)
    const groupedMap = new Map<string, EEGData>();

    records.forEach((record) => {
        // Create a unique key for this combination
        const key = `${record.patient_id || 'unknown'}|${record.eeg_id}|${record.spectrogram_id}|${record.eeg_label_offset_seconds}`;

        if (!groupedMap.has(key)) {
            // First record for this key, just store it
            groupedMap.set(key, { ...record });
        } else {
            // Combine vote values with existing record
            const existingRecord = groupedMap.get(key)!;

            // Sum up the vote fields
            existingRecord.seizure_vote = (
                parseFloat(existingRecord.seizure_vote || '0') + parseFloat(record.seizure_vote || '0')
            ).toString();
            existingRecord.lpd_vote = (
                parseFloat(existingRecord.lpd_vote || '0') + parseFloat(record.lpd_vote || '0')
            ).toString();
            existingRecord.gpd_vote = (
                parseFloat(existingRecord.gpd_vote || '0') + parseFloat(record.gpd_vote || '0')
            ).toString();
            existingRecord.lrda_vote = (
                parseFloat(existingRecord.lrda_vote || '0') + parseFloat(record.lrda_vote || '0')
            ).toString();
            existingRecord.grda_vote = (
                parseFloat(existingRecord.grda_vote || '0') + parseFloat(record.grda_vote || '0')
            ).toString();
            existingRecord.other_vote = (
                parseFloat(existingRecord.other_vote || '0') + parseFloat(record.other_vote || '0')
            ).toString();

            // Keep the original record with updated vote values
            groupedMap.set(key, existingRecord);
        }
    });

    return Array.from(groupedMap.values());
}
