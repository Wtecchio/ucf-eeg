"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, RefreshCw, Download } from "lucide-react"
import { type ParsedEEGData, convertToSpectrogramData } from "./parquet-parser"

interface MultiChannelSpectrogramProps {
    data: ParsedEEGData | null
    title?: string
    patientId?: string
    recordId?: string
}

export default function MultiChannelSpectrogram({
                                                    data,
                                                    title = "EEG Spectrogram",
                                                    patientId,
                                                    recordId,
                                                }: MultiChannelSpectrogramProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [colorMap, setColorMap] = useState<string>("viridis")
    const [timeRange, setTimeRange] = useState<[number, number]>([0, 100])
    const [zoomLevel, setZoomLevel] = useState<number>(1)
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [selectedChannel, setSelectedChannel] = useState<string>("LL")

    // Color maps for spectrogram visualization
    const colorMaps = {
        viridis: [
            [68, 1, 84],
            [72, 40, 120],
            [62, 83, 160],
            [49, 104, 142],
            [38, 130, 142],
            [31, 158, 137],
            [53, 183, 121],
            [109, 205, 89],
            [180, 222, 44],
            [253, 231, 37],
        ],
        jet: [
            [0, 0, 131],
            [0, 60, 170],
            [5, 255, 255],
            [255, 255, 0],
            [250, 0, 0],
        ],
        hot: [
            [0, 0, 0],
            [230, 0, 0],
            [255, 210, 0],
            [255, 255, 255],
        ],
        grayscale: [
            [0, 0, 0],
            [255, 255, 255],
        ],
    }

    // Function to interpolate color based on value
    const getColor = (value: number, min: number, max: number) => {
        const normalizedValue = (value - min) / (max - min)
        const selectedColorMap = colorMaps[colorMap as keyof typeof colorMaps] || colorMaps.viridis

        const index = Math.min(Math.floor(normalizedValue * (selectedColorMap.length - 1)), selectedColorMap.length - 2)

        const t = normalizedValue * (selectedColorMap.length - 1) - index

        const color1 = selectedColorMap[index]
        const color2 = selectedColorMap[index + 1]

        return [
            Math.round(color1[0] * (1 - t) + color2[0] * t),
            Math.round(color1[1] * (1 - t) + color2[1] * t),
            Math.round(color1[2] * (1 - t) + color2[2] * t),
        ]
    }

    // Draw the spectrogram on the canvas
    const drawSpectrogram = () => {
        if (!canvasRef.current || !data) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        setIsLoading(true)

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Convert multi-channel data to spectrogram data for the selected channel
        const spectrogramData = convertToSpectrogramData(data, selectedChannel as keyof ParsedEEGData["channels"])

        // Calculate dimensions
        const width = canvas.width
        const height = canvas.height

        // Get the min and max power values for color scaling
        let minPower = Number.POSITIVE_INFINITY
        let maxPower = Number.NEGATIVE_INFINITY

        for (const row of spectrogramData.powerValues) {
            for (const value of row) {
                if (value < minPower) minPower = value
                if (value > maxPower) maxPower = value
            }
        }

        // Apply time range filter
        const startTimeIndex = Math.floor(spectrogramData.times.length * (timeRange[0] / 100))
        const endTimeIndex = Math.ceil(spectrogramData.times.length * (timeRange[1] / 100))

        const timeSlice = spectrogramData.times.slice(startTimeIndex, endTimeIndex)
        const powerSlice = spectrogramData.powerValues.map((row) => row.slice(startTimeIndex, endTimeIndex))

        // Calculate pixel size
        const pixelWidth = width / timeSlice.length
        const pixelHeight = height / spectrogramData.frequencies.length

        // Draw the spectrogram
        for (let i = 0; i < spectrogramData.frequencies.length; i++) {
            for (let j = 0; j < timeSlice.length; j++) {
                const power = powerSlice[i][j]
                const [r, g, b] = getColor(power, minPower, maxPower)

                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
                ctx.fillRect(
                    j * pixelWidth,
                    height - (i + 1) * pixelHeight, // Invert y-axis so low frequencies are at the bottom
                    pixelWidth * zoomLevel,
                    pixelHeight * zoomLevel,
                )
            }
        }

        // Draw axes
        ctx.strokeStyle = "#666"
        ctx.lineWidth = 1

        // X-axis (time)
        ctx.beginPath()
        ctx.moveTo(0, height)
        ctx.lineTo(width, height)
        ctx.stroke()

        // Y-axis (frequency)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(0, height)
        ctx.stroke()

        // X-axis labels (time)
        ctx.fillStyle = "#666"
        ctx.font = "10px Arial"
        ctx.textAlign = "center"

        const timeStep = Math.max(1, Math.floor(timeSlice.length / 5))
        for (let i = 0; i < timeSlice.length; i += timeStep) {
            const x = i * pixelWidth
            const time = timeSlice[i].toFixed(1)
            ctx.fillText(`${time}s`, x, height - 5)
        }

        // Y-axis labels (frequency)
        ctx.textAlign = "right"

        const freqStep = Math.max(1, Math.floor(spectrogramData.frequencies.length / 5))
        for (let i = 0; i < spectrogramData.frequencies.length; i += freqStep) {
            const y = height - i * pixelHeight
            const freq = spectrogramData.frequencies[i].toFixed(0)
            ctx.fillText(`${freq}Hz`, 25, y)
        }

        setIsLoading(false)
    }

    // Handle zoom in/out
    const handleZoomIn = () => {
        setZoomLevel((prev) => Math.min(prev + 0.2, 3))
    }

    const handleZoomOut = () => {
        setZoomLevel((prev) => Math.max(prev - 0.2, 0.5))
    }

    // Handle download as PNG
    const handleDownload = () => {
        if (!canvasRef.current) return

        const link = document.createElement("a")
        link.download = `spectrogram_${patientId || "patient"}_${recordId || "record"}_${selectedChannel}.png`
        link.href = canvasRef.current.toDataURL("image/png")
        link.click()
    }

    // Redraw when data or visualization parameters change
    useEffect(() => {
        drawSpectrogram()
    }, [data, colorMap, timeRange, zoomLevel, selectedChannel])

    // If no data is available
    if (!data) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center">
                    <p className="text-muted-foreground">No spectrogram data available</p>
                </CardContent>
            </Card>
        )
    }


    // Add your debug logs here:
    if (data && data.metadata) {
        console.log("data.metadata:", data.metadata);
        console.log("samplingRate:", data.metadata.samplingRate);
        console.log("duration:", data.metadata.duration);
    }




    return (
        // Inside your component’s render method (before the return statement)
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="flex justify-between items-center">
                    <span>{title}</span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={handleZoomIn}>
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={handleZoomOut}>
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => drawSpectrogram()}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={handleDownload}>
                            <Download className="h-4 w-4" />
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-4">
                        <div className="w-full sm:w-[200px]">
                            <Select value={colorMap} onValueChange={setColorMap}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Color Map" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="viridis">Viridis</SelectItem>
                                    <SelectItem value="jet">Jet</SelectItem>
                                    <SelectItem value="hot">Hot</SelectItem>
                                    <SelectItem value="grayscale">Grayscale</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full sm:w-[200px]">
                            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Channel" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LL">Left Lateral (LL)</SelectItem>
                                    <SelectItem value="RL">Right Lateral (RL)</SelectItem>
                                    <SelectItem value="LP">Left Parasagittal (LP)</SelectItem>
                                    <SelectItem value="RP">Right Parasagittal (RP)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 px-2">
                            <p className="text-sm text-muted-foreground mb-2">Time Range</p>
                            <Slider
                                defaultValue={[0, 100]}
                                max={100}
                                step={1}
                                value={timeRange}
                                onValueChange={(value) => setTimeRange(value as [number, number])}
                            />
                        </div>
                    </div>

                    <div className="relative border rounded-md">
                        {isLoading && (
                            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
                                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        )}
                        <canvas ref={canvasRef} width={800} height={400} className="w-full h-[400px] rounded-md" />
                    </div>

                    <div className="text-xs text-muted-foreground">
                        {patientId && (
                            <p>
                                Patient {patientId} - Channel {selectedChannel} - Sampling Rate: {data.metadata.samplingRate.toFixed(1)}{" "}
                                Hz - Duration: {data.metadata.duration.toFixed(1)} ms
                            </p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

