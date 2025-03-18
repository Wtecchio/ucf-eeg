'use client';

import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { type ParsedEEGData, convertToSpectrogramData } from './parquet-parser';
import { Download, Layers, RefreshCw, SplitSquareVertical, ZoomIn, ZoomOut } from 'lucide-react';

interface MultiChannelSpectrogramProps {
    data: ParsedEEGData | null;
    title?: string;
    patientId?: string;
    recordId?: string;
    offsets?: number[];
}

export default function MultiChannelSpectrogram({
    data,
    title = 'EEG Spectrogram',
    patientId,
    recordId,
    offsets
}: MultiChannelSpectrogramProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [colorMap, setColorMap] = useState<string>('viridis');
    const [timeRange, setTimeRange] = useState<[number, number]>([0, 100]);
    const [zoomLevel, setZoomLevel] = useState<number>(1);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [selectedChannel, setSelectedChannel] = useState<string>('LL');
    const [selectedOffset, setSelectedOffset] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<'individual' | 'combined'>('individual');

    // Set the initial selected offset when offsets array changes
    useEffect(() => {
        if (offsets && offsets.length > 0 && selectedOffset === null) {
            setSelectedOffset(offsets[0]);
        }
    }, [offsets, selectedOffset]);

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
            [253, 231, 37]
        ],
        jet: [
            [0, 0, 131],
            [0, 60, 170],
            [5, 255, 255],
            [255, 255, 0],
            [250, 0, 0]
        ],
        hot: [
            [0, 0, 0],
            [230, 0, 0],
            [255, 210, 0],
            [255, 255, 255]
        ],
        grayscale: [
            [0, 0, 0],
            [255, 255, 255]
        ]
    };

    // Function to interpolate color based on value
    const getColor = (value: number, min: number, max: number) => {
        const normalizedValue = (value - min) / (max - min);
        const selectedColorMap = colorMaps[colorMap as keyof typeof colorMaps] || colorMaps.viridis;

        const index = Math.min(
            Math.floor(normalizedValue * (selectedColorMap.length - 1)),
            selectedColorMap.length - 2
        );

        const t = normalizedValue * (selectedColorMap.length - 1) - index;

        const color1 = selectedColorMap[index];
        const color2 = selectedColorMap[index + 1];

        return [
            Math.round(color1[0] * (1 - t) + color2[0] * t),
            Math.round(color1[1] * (1 - t) + color2[1] * t),
            Math.round(color1[2] * (1 - t) + color2[2] * t)
        ];
    };

    // Draw the spectrogram on the canvas
    const drawSpectrogram = () => {
        if (!canvasRef.current || !data) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setIsLoading(true);

        try {
            // Clear the canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Different behavior based on view mode
            if (viewMode === 'individual' && selectedOffset !== null) {
                // Draw single spectrogram for the selected offset
                drawSingleSpectrogram(ctx, canvas.width, canvas.height);
            } else if (viewMode === 'combined' && offsets && offsets.length > 0) {
                // Draw combined spectrogram of all offsets
                drawCombinedSpectrogram(ctx, canvas.width, canvas.height);
            } else {
                // Fallback to single spectrogram
                drawSingleSpectrogram(ctx, canvas.width, canvas.height);
            }
        } catch (error) {
            console.error('Error drawing spectrogram:', error);

            // Draw error message on canvas
            ctx.font = '16px Arial';
            ctx.fillStyle = '#ff0000';
            ctx.textAlign = 'center';
            ctx.fillText('Error rendering spectrogram', canvas.width / 2, canvas.height / 2 - 20);
            ctx.font = '12px Arial';
            ctx.fillText('Check console for details', canvas.width / 2, canvas.height / 2 + 10);
        } finally {
            setIsLoading(false);
        }
    };

    // Draw a single spectrogram for the selected offset
    const drawSingleSpectrogram = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        // Convert multi-channel data to spectrogram data for the selected channel
        const spectrogramData = data
            ? convertToSpectrogramData(data, selectedChannel as keyof ParsedEEGData['channels'])
            : null;

        // Check if the spectrogramData has the expected structure
        if (
            !spectrogramData ||
            !spectrogramData.powerValues ||
            !Array.isArray(spectrogramData.powerValues) ||
            !spectrogramData.times ||
            !spectrogramData.frequencies
        ) {
            throw new Error('Invalid spectrogram data format');
        }

        // Get the min and max power values for color scaling
        let minPower = Number.POSITIVE_INFINITY;
        let maxPower = Number.NEGATIVE_INFINITY;

        for (const row of spectrogramData.powerValues) {
            if (!Array.isArray(row)) continue;
            for (const value of row) {
                if (value < minPower) minPower = value;
                if (value > maxPower) maxPower = value;
            }
        }

        // Apply time range filter
        const startTimeIndex = Math.floor(spectrogramData.times.length * (timeRange[0] / 100));
        const endTimeIndex = Math.ceil(spectrogramData.times.length * (timeRange[1] / 100));

        const timeSlice = spectrogramData.times.slice(startTimeIndex, endTimeIndex);
        const powerSlice = spectrogramData.powerValues.map((row) =>
            Array.isArray(row) ? row.slice(startTimeIndex, endTimeIndex) : []
        );

        // Calculate pixel size
        const pixelWidth = width / (timeSlice.length || 1); // Prevent division by zero
        const pixelHeight = height / (spectrogramData.frequencies.length || 1);

        // Draw the spectrogram
        for (let i = 0; i < spectrogramData.frequencies.length; i++) {
            if (!powerSlice[i] || !Array.isArray(powerSlice[i])) continue;

            for (let j = 0; j < timeSlice.length; j++) {
                const power = powerSlice[i][j];
                if (power === undefined) continue;

                const [r, g, b] = getColor(power, minPower, maxPower);

                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(
                    j * pixelWidth,
                    height - (i + 1) * pixelHeight, // Invert y-axis so low frequencies are at the bottom
                    pixelWidth * zoomLevel,
                    pixelHeight * zoomLevel
                );
            }
        }

        // Draw axes
        drawAxes(ctx, width, height, spectrogramData.frequencies, timeSlice);
    };

    // Draw a combined spectrogram showing all offsets
    const drawCombinedSpectrogram = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        if (!offsets || offsets.length === 0) return;

        // Sort offsets in ascending order
        const sortedOffsets = [...offsets].sort((a, b) => a - b);

        // Get the basic spectrogram data structure
        const spectrogramData = convertToSpectrogramData(data, selectedChannel as keyof ParsedEEGData['channels']);

        if (!spectrogramData || !spectrogramData.powerValues || !spectrogramData.frequencies) {
            throw new Error('Invalid spectrogram data format');
        }

        // Create a concatenated time axis
        const timeSegmentLength = spectrogramData.times.length;
        const concatenatedTimes: number[] = [];
        const concatenatedPowerValues: number[][] = [];

        // Initialize the concatenated power values array
        for (let i = 0; i < spectrogramData.frequencies.length; i++) {
            concatenatedPowerValues.push([]);
        }

        // For each offset, add its data to the concatenated arrays
        let currentTimeOffset = 0;

        sortedOffsets.forEach((offset, offsetIndex) => {
            // In a real implementation, you would get different data for each offset
            // Here we'll simulate it by adding the offset to the times

            // Add the times for this segment, continuing from where the last segment ended
            spectrogramData.times.forEach((time) => {
                concatenatedTimes.push(currentTimeOffset + time);
            });

            // Add the power values for this segment
            spectrogramData.powerValues.forEach((row, freqIndex) => {
                if (!Array.isArray(row)) return;

                // Simulate different data for different offsets (you'd replace this with real data)
                const offsetModifier = 1 + offset / 10; // Just for demonstration

                row.forEach((value) => {
                    if (value === undefined) {
                        concatenatedPowerValues[freqIndex].push(0);
                    } else {
                        concatenatedPowerValues[freqIndex].push(value * offsetModifier);
                    }
                });
            });

            // Update the time offset for the next segment
            // Add a small gap between segments
            currentTimeOffset += spectrogramData.times[spectrogramData.times.length - 1] + 1;
        });

        // Get min/max power values for color scaling
        let minPower = Number.POSITIVE_INFINITY;
        let maxPower = Number.NEGATIVE_INFINITY;

        for (const row of concatenatedPowerValues) {
            for (const value of row) {
                if (value < minPower) minPower = value;
                if (value > maxPower) maxPower = value;
            }
        }

        // Apply time range filter - this gets more complex with concatenated data
        // We'll convert the percentage to indices in the concatenated array
        const totalTimePoints = concatenatedTimes.length;
        const startTimeIndex = Math.floor(totalTimePoints * (timeRange[0] / 100));
        const endTimeIndex = Math.ceil(totalTimePoints * (timeRange[1] / 100));

        const timeSlice = concatenatedTimes.slice(startTimeIndex, endTimeIndex);
        const powerSlice = concatenatedPowerValues.map((row) => row.slice(startTimeIndex, endTimeIndex));

        // Calculate pixel size
        const pixelWidth = width / (timeSlice.length || 1);
        const pixelHeight = height / (spectrogramData.frequencies.length || 1);

        // Draw the concatenated spectrogram
        for (let i = 0; i < spectrogramData.frequencies.length; i++) {
            for (let j = 0; j < timeSlice.length; j++) {
                const power = powerSlice[i][j];
                if (power === undefined) continue;

                const [r, g, b] = getColor(power, minPower, maxPower);

                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(
                    j * pixelWidth,
                    height - (i + 1) * pixelHeight,
                    pixelWidth * zoomLevel,
                    pixelHeight * zoomLevel
                );
            }
        }

        // Draw segment dividers
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;

        let segmentEndTime = 0;
        sortedOffsets.forEach((offset, index) => {
            if (index === sortedOffsets.length - 1) return; // Skip the last one

            segmentEndTime += timeSegmentLength;

            // Only draw if it's in the visible range
            if (segmentEndTime >= startTimeIndex && segmentEndTime <= endTimeIndex) {
                const x = (segmentEndTime - startTimeIndex) * pixelWidth;

                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
        });
        ctx.setLineDash([]);

        // Draw axes - we need special handling for the concatenated time axis
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;

        // X-axis (time)
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(width, height);
        ctx.stroke();

        // Y-axis (frequency)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, height);
        ctx.stroke();

        // X-axis labels (time)
        ctx.fillStyle = '#666';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';

        const timeStep = Math.max(1, Math.floor(timeSlice.length / 8));
        for (let i = 0; i < timeSlice.length; i += timeStep) {
            const x = i * pixelWidth;
            const time = timeSlice[i].toFixed(1);
            ctx.fillText(`${time}s`, x, height - 5);
        }

        // Y-axis labels (frequency)
        ctx.textAlign = 'right';

        const freqStep = Math.max(1, Math.floor(spectrogramData.frequencies.length / 5));
        for (let i = 0; i < spectrogramData.frequencies.length; i += freqStep) {
            const y = height - i * pixelHeight;
            const freq = spectrogramData.frequencies[i].toFixed(0);
            ctx.fillText(`${freq}Hz`, 25, y);
        }

        // Add a label to indicate this is a concatenated view
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(10, 10, 200, 25);
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Concatenated View (${sortedOffsets.length} segments)`, 15, 27);
    };
    // Helper function to draw axes
    const drawAxes = (
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        frequencies: number[],
        timeSlice: number[]
    ) => {
        // Draw axes
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;

        // X-axis (time)
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(width, height);
        ctx.stroke();

        // Y-axis (frequency)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, height);
        ctx.stroke();

        // X-axis labels (time)
        ctx.fillStyle = '#666';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';

        const timeStep = Math.max(1, Math.floor(timeSlice.length / 5));
        for (let i = 0; i < timeSlice.length; i += timeStep) {
            const x = i * (width / (timeSlice.length || 1));
            const time = timeSlice[i] !== undefined ? timeSlice[i].toFixed(1) : '0.0';
            ctx.fillText(`${time}s`, x, height - 5);
        }

        // Y-axis labels (frequency)
        ctx.textAlign = 'right';

        const freqStep = Math.max(1, Math.floor(frequencies.length / 5));
        for (let i = 0; i < frequencies.length; i += freqStep) {
            const y = height - i * (height / (frequencies.length || 1));
            const freq = frequencies[i] !== undefined ? frequencies[i].toFixed(0) : '0';
            ctx.fillText(`${freq}Hz`, 25, y);
        }
    };

    // Handle zoom in/out
    const handleZoomIn = () => {
        setZoomLevel((prev) => Math.min(prev + 0.2, 3));
    };

    const handleZoomOut = () => {
        setZoomLevel((prev) => Math.max(prev - 0.2, 0.5));
    };

    // Toggle between individual and combined view
    const toggleViewMode = () => {
        setViewMode((prev) => (prev === 'individual' ? 'combined' : 'individual'));
    };

    // Handle download as PNG
    const handleDownload = () => {
        if (!canvasRef.current) return;

        const link = document.createElement('a');
        link.download = `spectrogram_${patientId || 'patient'}_${recordId || 'record'}_${selectedChannel}_${viewMode}.png`;
        link.href = canvasRef.current.toDataURL('image/png');
        link.click();
    };

    // Redraw when data or visualization parameters change
    useEffect(() => {
        console.log('Effect triggered with offset:', selectedOffset, 'viewMode:', viewMode);
        drawSpectrogram();
    }, [data, colorMap, timeRange, zoomLevel, selectedChannel, selectedOffset, viewMode]);

    // If no data is available
    if (!data) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent className='flex h-[300px] items-center justify-center'>
                    <p className='text-muted-foreground'>No spectrogram data available</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className='pb-2'>
                <CardTitle className='flex items-center justify-between'>
                    <span>{title}</span>
                    <div className='flex gap-2'>
                        <Button
                            variant='outline'
                            size='icon'
                            onClick={toggleViewMode}
                            title={viewMode === 'individual' ? 'Switch to combined view' : 'Switch to individual view'}>
                            {viewMode === 'individual' ? (
                                <Layers className='h-4 w-4' />
                            ) : (
                                <SplitSquareVertical className='h-4 w-4' />
                            )}
                        </Button>
                        <Button variant='outline' size='icon' onClick={handleZoomIn}>
                            <ZoomIn className='h-4 w-4' />
                        </Button>
                        <Button variant='outline' size='icon' onClick={handleZoomOut}>
                            <ZoomOut className='h-4 w-4' />
                        </Button>
                        <Button variant='outline' size='icon' onClick={() => drawSpectrogram()}>
                            <RefreshCw className='h-4 w-4' />
                        </Button>
                        <Button variant='outline' size='icon' onClick={handleDownload}>
                            <Download className='h-4 w-4' />
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className='space-y-4'>
                    {/* View mode indicator */}
                    <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                            <Badge variant='outline'>
                                {viewMode === 'individual' ? 'Individual Segment View' : 'Combined Segments View'}
                            </Badge>
                            {viewMode === 'combined' && offsets && (
                                <span className='text-muted-foreground text-xs'>
                                    ({offsets.length} offsets combined)
                                </span>
                            )}
                        </div>

                        {/* Offset selector - only show in individual view mode */}
                        {viewMode === 'individual' && offsets && offsets.length > 1 && (
                            <div className='flex flex-wrap gap-1'>
                                {offsets.map((offset, i) => (
                                    <Badge
                                        key={i}
                                        variant={selectedOffset === offset ? 'default' : 'outline'}
                                        className='cursor-pointer'
                                        onClick={() => {
                                            console.log('Setting offset to:', offset);
                                            setSelectedOffset(offset);
                                        }}>
                                        {offset.toFixed(1)}s
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className='flex flex-wrap gap-4'>
                        <div className='w-full sm:w-[200px]'>
                            <Select value={colorMap} onValueChange={setColorMap}>
                                <SelectTrigger>
                                    <SelectValue placeholder='Color Map' />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='viridis'>Viridis</SelectItem>
                                    <SelectItem value='jet'>Jet</SelectItem>
                                    <SelectItem value='hot'>Hot</SelectItem>
                                    <SelectItem value='grayscale'>Grayscale</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className='w-full sm:w-[200px]'>
                            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                                <SelectTrigger>
                                    <SelectValue placeholder='Channel' />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='LL'>Left Lateral (LL)</SelectItem>
                                    <SelectItem value='RL'>Right Lateral (RL)</SelectItem>
                                    <SelectItem value='LP'>Left Parasagittal (LP)</SelectItem>
                                    <SelectItem value='RP'>Right Parasagittal (RP)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className='flex-1 px-2'>
                            <p className='text-muted-foreground mb-2 text-sm'>Time Range</p>
                            <Slider
                                defaultValue={[0, 100]}
                                max={100}
                                step={1}
                                value={timeRange}
                                onValueChange={(value) => setTimeRange(value as [number, number])}
                            />
                        </div>
                    </div>

                    <div className='relative rounded-md border'>
                        {isLoading && (
                            <div className='bg-background/80 absolute inset-0 z-10 flex items-center justify-center'>
                                <RefreshCw className='text-primary h-6 w-6 animate-spin' />
                            </div>
                        )}
                        <canvas ref={canvasRef} width={800} height={400} className='h-[400px] w-full rounded-md' />
                    </div>

                    <div className='text-muted-foreground text-xs'>
                        {patientId && (
                            <p>
                                Patient {patientId} - Channel {selectedChannel}
                                {viewMode === 'individual' &&
                                    selectedOffset !== null &&
                                    ` - Offset: ${selectedOffset.toFixed(1)}s`}
                                {data.metadata?.samplingRate &&
                                    ` - Sampling Rate: ${data.metadata.samplingRate.toFixed(1)} Hz`}
                                {data.metadata?.duration && ` - Duration: ${data.metadata.duration.toFixed(1)} ms`}
                            </p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
