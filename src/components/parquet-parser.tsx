import * as Arrow from "apache-arrow"

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

// Parse Parquet file containing EEG metadata
export async function parseEEGParquet(buffer: ArrayBuffer): Promise<EEGData[]> {
    try {
        // Use Apache Arrow to parse the Parquet file
        const table = await Arrow.Table.from(new Uint8Array(buffer))

        // Convert Arrow Table to JavaScript objects
        const records: EEGData[] = []

        for (let i = 0; i < table.numRows; i++) {
            const record: any = {}

            // Extract each field from the table
            table.schema.fields.forEach((field) => {
                const column = table.getChildAt(table.schema.fields.indexOf(field))
                if (column) {
                    record[field.name] = column.get(i)?.toString() || ""
                }
            })

            records.push(record as EEGData)
        }

        return records
    } catch (error) {
        console.error("Error parsing EEG Parquet file:", error)
        throw new Error("Failed to parse EEG Parquet file")
    }
}

// Parse Parquet file containing spectrogram data
export async function parseSpectrogramParquet(buffer: ArrayBuffer): Promise<SpectrogramData> {
    try {
        // Use Apache Arrow to parse the Parquet file
        const table = await Arrow.Table.from(new Uint8Array(buffer))

        // Extract metadata from the table
        const metadata = {
            patientId: "",
            recordId: "",
            samplingRate: 0,
            duration: 0,
        }

        // Try to extract metadata from the table
        table.schema.metadata.forEach((value, key) => {
            if (key === "patient_id") metadata.patientId = value
            if (key === "record_id") metadata.recordId = value
            if (key === "sampling_rate") metadata.samplingRate = Number.parseFloat(value)
            if (key === "duration") metadata.duration = Number.parseFloat(value)
        })

        // Extract time values (assuming there's a 'time' column)
        const timeColumn = table.getColumn("time")
        const times: number[] = []

        if (timeColumn) {
            for (let i = 0; i < table.numRows; i++) {
                times.push(Number.parseFloat(timeColumn.get(i)?.toString() || "0"))
            }
        } else {
            // If no time column, create evenly spaced time points
            for (let i = 0; i < table.numRows; i++) {
                times.push((i / (table.numRows - 1)) * (metadata.duration || 10))
            }
        }

        // Extract frequency values (assuming there's a 'frequency' column)
        const freqColumn = table.getColumn("frequency")
        const frequencies: number[] = []

        if (freqColumn) {
            for (let i = 0; i < freqColumn.length; i++) {
                frequencies.push(Number.parseFloat(freqColumn.get(i)?.toString() || "0"))
            }
        } else {
            // If no frequency column, try to infer from other columns
            // Assuming columns other than 'time' represent frequency bands
            const freqColumns = table.schema.fields.filter((field) => field.name !== "time").map((field) => field.name)

            freqColumns.forEach((name) => {
                if (!isNaN(Number.parseFloat(name))) {
                    frequencies.push(Number.parseFloat(name))
                }
            })

            // If still no frequencies, create default range
            if (frequencies.length === 0) {
                for (let i = 0; i < 100; i++) {
                    frequencies.push(i)
                }
            }
        }

        // Sort frequencies in ascending order
        frequencies.sort((a, b) => a - b)

        // Extract power values for each frequency and time point
        const powerValues: number[][] = []

        // Initialize the power values array
        for (let i = 0; i < frequencies.length; i++) {
            powerValues.push(new Array(times.length).fill(0))
        }

        // Fill in the power values
        for (let i = 0; i < frequencies.length; i++) {
            const freq = frequencies[i].toString()
            const column = table.getColumn(freq)

            if (column) {
                for (let j = 0; j < times.length; j++) {
                    const value = column.get(j)
                    powerValues[i][j] = Number.parseFloat(value?.toString() || "0")
                }
            }
        }

        return {
            times,
            frequencies,
            powerValues,
            metadata,
        }
    } catch (error) {
        console.error("Error parsing Spectrogram Parquet file:", error)
        throw new Error("Failed to parse Spectrogram Parquet file")
    }
}

// Generate mock spectrogram data for testing
export function generateMockSpectrogramData(patientId = "1", recordId = "EEG1000"): SpectrogramData {
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

