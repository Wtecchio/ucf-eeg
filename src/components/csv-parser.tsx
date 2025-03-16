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

