import { tableFromIPC } from "apache-arrow"
import Papa from 'papaparse';

export interface ChannelData {
    frequencies: number[]
    powerValues: number[][] // [time][frequency]
}

export interface ParsedEEGData {
    times: number[]
    channels: {
        LL: ChannelData
        RL: ChannelData
        LP: ChannelData
        RP: ChannelData
    }
    metadata: {
        patientId: string
        recordId: string
        samplingRate: number
        duration: number
        totalFrames: number
    }
}

export interface EEGData {
    eeg_id: string
    eeg_sub_id: string
    eeg_label_offset_seconds: string
    spectrogram_id: string
    spectrogram_sub_id: string
    spectrogram_label_offset_seconds: string
    label_id: string
    patient_id: string
    expert_consensus: string
    seizure_vote: string
    lpd_vote: string
    gpd_vote: string
    lrda_vote: string
    grda_vote: string
    other_vote: string
}

export interface SpectrogramData {
    times: number[]
    frequencies: number[]
    powerValues: number[][]
    metadata: {
        patientId: string
        recordId: string
        samplingRate: number
        duration: number
    }
}

export async function getSpectrogramIds() {
    try {
        // Fetch the CSV file
        const response = await fetch('/sample_data/sample_train.csv');
        const csvText = await response.text();

        // Parse CSV
        const results = Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
        });

        // Create an array of objects with patient ID and spectrogram ID
        const patientData = results.data
            .filter((row: any) => row.spectrogram_id) // Filter out rows with missing spectrogram_id
            .map((row: any) => ({
                patientId: row.patient_id.toString(),
                spectrogramId: row.spectrogram_id.toString(),
                diagnosis: row.expert_consensus
            }));

        // Extract just the spectrogram IDs for file loading
        const spectrogramIds = patientData.map((item: any) => item.spectrogramId);

        return {
            spectrogramIds,  // Array of spectrogram IDs to load parquet files
            patientData      // Full mapping of patient to spectrogram with diagnosis
        };
    } catch (error) {
        console.error('Error parsing spectrogram IDs from CSV:', error);
        return { spectrogramIds: [], patientData: [] };
    }
}

export async function loadSpectrogramById(id: string, isPatientId: boolean = true): Promise<ParsedEEGData> {
    try {
        // Determine the file path based on whether we're using patient ID or spectrogram ID
        const filePath = isPatientId
            ? `/sample_data/spectrograms/${id}.parquet`
            : `/sample_data/spectrograms/spectrogram_${id}.parquet`;

        const response = await fetch(filePath);
        const arrayBuffer = await response.arrayBuffer();
        return parseEEGParquet(arrayBuffer);
    } catch (error) {
        console.error(`Error loading spectrogram for ID ${id}:`, error);
        throw error;
    }
}

export async function parseEEGParquet(buffer: ArrayBuffer): Promise<ParsedEEGData> {
    const table = await tableFromIPC(new Uint8Array(buffer))

    // Extract time column first to establish recording length
    const timeColumn = table.getChild("time")
    const times: number[] = []
    for (let i = 0; i < table.numRows; i++) {
        times.push(Number(timeColumn?.get(i)) || 0)
    }

    // Initialize channel data structure
    const channels: Record<string, ChannelData> = {
        LL: { frequencies: [], powerValues: [] },
        RL: { frequencies: [], powerValues: [] },
        LP: { frequencies: [], powerValues: [] },
        RP: { frequencies: [], powerValues: [] },
    }

    // Get all column names and organize by channel
    const columnsByChannel: Record<string, { name: string; frequency: number }[]> = {
        LL: [],
        RL: [],
        LP: [],
        RP: [],
    }

    // Parse column names and extract frequencies
    table.schema.fields.forEach((field) => {
        const name = field.name
        if (name === "time") return // Skip time column

        Object.keys(channels).forEach((channel) => {
            if (name.startsWith(channel + "_")) {
                const frequency = Number.parseFloat(name.substring(channel.length + 1))
                if (!isNaN(frequency)) {
                    columnsByChannel[channel].push({ name, frequency })
                }
            }
        })
    })

    // Sort frequencies for each channel
    Object.keys(columnsByChannel).forEach((channel) => {
        columnsByChannel[channel].sort((a, b) => a.frequency - b.frequency)

        // Store sorted frequencies
        channels[channel].frequencies = columnsByChannel[channel].map((col) => col.frequency)

        // Initialize power values array
        const powerValues: number[][] = new Array(times.length)
        for (let t = 0; t < times.length; t++) {
            powerValues[t] = new Array(columnsByChannel[channel].length).fill(0)
        }

        // Fill power values
        columnsByChannel[channel].forEach((col, freqIndex) => {
            const column = table.getChild(col.name)
            if (column) {
                for (let t = 0; t < times.length; t++) {
                    powerValues[t][freqIndex] = Number(column.get(t)) || 0
                }
            }
        })

        channels[channel].powerValues = powerValues
    })

    // Calculate sampling rate
    const samplingRate =
        times.length > 1
            ? 1000 / (times[1] - times[0])
            : Number.parseFloat(table.schema.metadata.get("sampling_rate") || "0")

    // Extract metadata
    const metadata = {
        patientId: table.schema.metadata.get("patient_id") || "",
        recordId: table.schema.metadata.get("record_id") || "",
        samplingRate: samplingRate,
        duration: times[times.length - 1] - times[0],
        totalFrames: times.length,
    }

    return {
        times,
        channels: channels as ParsedEEGData["channels"],
        metadata,
    }
}

// Helper function to get frame data at a specific time index
export function getFrameData(parsedData: ParsedEEGData, timeIndex: number) {
    if (timeIndex < 0 || timeIndex >= parsedData.times.length) {
        throw new Error("Time index out of bounds")
    }

    return {
        time: parsedData.times[timeIndex],
        channels: {
            LL: parsedData.channels.LL.powerValues[timeIndex],
            RL: parsedData.channels.RL.powerValues[timeIndex],
            LP: parsedData.channels.LP.powerValues[timeIndex],
            RP: parsedData.channels.RP.powerValues[timeIndex],
        },
    }
}

// Helper function to get average power across a time range for each frequency
export function getAveragePowerSpectrum(parsedData: ParsedEEGData, startTimeIndex: number, endTimeIndex: number) {
    if (startTimeIndex < 0 || endTimeIndex >= parsedData.times.length || startTimeIndex > endTimeIndex) {
        throw new Error("Time indices out of bounds")
    }

    const result: Record<string, number[]> = {}

    Object.keys(parsedData.channels).forEach((channel) => {
        const channelData = parsedData.channels[channel as keyof typeof parsedData.channels]
        const frequencies = channelData.frequencies
        const averagePower = new Array(frequencies.length).fill(0)

        for (let freqIdx = 0; freqIdx < frequencies.length; freqIdx++) {
            let sum = 0
            for (let timeIdx = startTimeIndex; timeIdx <= endTimeIndex; timeIdx++) {
                sum += channelData.powerValues[timeIdx][freqIdx]
            }
            averagePower[freqIdx] = sum / (endTimeIndex - startTimeIndex + 1)
        }

        result[channel] = averagePower
    })

    return result
}

// Convert ParsedEEGData to SpectrogramData for a specific channel
export function convertToSpectrogramData(
    parsedData: ParsedEEGData,
    channel: keyof ParsedEEGData["channels"],
): SpectrogramData {
    const channelData = parsedData.channels[channel]

    // Convert from [time][frequency] to [frequency][time]
    const powerValues: number[][] = []

    for (let f = 0; f < channelData.frequencies.length; f++) {
        const row: number[] = []
        for (let t = 0; t < parsedData.times.length; t++) {
            row.push(channelData.powerValues[t][f])
        }
        powerValues.push(row)
    }

    return {
        times: parsedData.times,
        frequencies: channelData.frequencies,
        powerValues,
        metadata: {
            patientId: parsedData.metadata.patientId,
            recordId: parsedData.metadata.recordId,
            samplingRate: parsedData.metadata.samplingRate,
            duration: parsedData.metadata.duration,
        },
    }
}

// Parse CSV data
export async function parseCSV(csvText: string): Promise<EEGData[]> {
    try {
        // Split the CSV text into lines
        const lines = csvText.trim().split("\n")

        // Extract headers from the first line
        const headers = lines[0].split(",").map((header) => header.trim())

        // Parse each line into an object
        const records: EEGData[] = []

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(",").map((value) => value.trim())

            // Skip lines with incorrect number of values
            if (values.length !== headers.length) continue

            const record: any = {}

            // Map each value to its corresponding header
            headers.forEach((header, index) => {
                record[header] = values[index]
            })

            records.push(record as EEGData)
        }

        return records
    } catch (error) {
        console.error("Error parsing CSV:", error)
        throw new Error("Failed to parse CSV data")
    }
}

// Fetch CSV data from URL
export async function fetchCSVFromURL(url: string): Promise<EEGData[]> {
    try {
        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`)
        }

        const csvText = await response.text()
        return parseCSV(csvText)
    } catch (error) {
        console.error("Error fetching CSV:", error)
        throw new Error("Failed to fetch CSV data from URL")
    }
}

// Generate mock spectrogram data for testing
export function generateSpectrogramData(patientId = "1", recordId = "EEG1000"): SpectrogramData {
    // Create time points (0 to 10 seconds)
    const times: number[] = []
    for (let i = 0; i < 200; i++) {
        times.push(i * 0.05) // 200 time points over 10 seconds
    }

    // Create frequency bands (0 to 50 Hz)
    const frequencies: number[] = []
    for (let i = 0; i < 50; i++) {
        frequencies.push(i)
    }

    // Create power values with some patterns
    const powerValues: number[][] = []

    for (let i = 0; i < frequencies.length; i++) {
        const row: number[] = []
        const freq = frequencies[i]

        for (let j = 0; j < times.length; j++) {
            const time = times[j]

            // Create some interesting patterns
            let value = 0

            // Base oscillation
            value += Math.sin(time * 2 * Math.PI * 0.5) * Math.exp(-freq / 20)

            // Add a burst at t=3s
            if (time > 3 && time < 4) {
                value += 3 * Math.exp(-Math.pow(freq - 10, 2) / 50)
            }

            // Add a burst at t=7s in higher frequencies
            if (time > 7 && time < 8) {
                value += 2 * Math.exp(-Math.pow(freq - 30, 2) / 40)
            }

            // Add some noise
            value += (Math.random() - 0.5) * 0.2

            row.push(value)
        }

        powerValues.push(row)
    }

    return {
        times,
        frequencies,
        powerValues,
        metadata: {
            patientId,
            recordId,
            samplingRate: 200,
            duration: 10,
        },
    }
}
