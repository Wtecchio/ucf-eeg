'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Settings, Download, AudioWaveformIcon as Waveform, RefreshCw } from "lucide-react";

// Import types
import type { ParsedEEGData } from './types';

// Define channel colors for consistent visualization
const CHANNEL_COLORS = [
    { name: 'LL', color: '#4f46e5' }, // Indigo
    { name: 'RL', color: '#2563eb' }, // Blue
    { name: 'LP', color: '#0891b2' }, // Cyan
    { name: 'RP', color: '#0d9488' }, // Teal
    { name: 'F3', color: '#7c3aed' }, // Violet
    { name: 'F4', color: '#c026d3' }, // Fuchsia
    { name: 'C3', color: '#db2777' }, // Pink
    { name: 'C4', color: '#e11d48' }, // Rose
    { name: 'P3', color: '#f59e0b' }, // Amber
    { name: 'P4', color: '#84cc16' }, // Lime
    { name: 'O1', color: '#10b981' }, // Emerald
    { name: 'O2', color: '#06b6d4' }  // Cyan
];

interface MultiChannelSpectrogramProps {
    data: ParsedEEGData | null;
    title?: string;
    patientId?: string;
    recordId?: string;
}

const MultiChannelSpectrogram: React.FC<MultiChannelSpectrogramProps> = ({
    data,
    title,
    patientId,
    recordId
}) => {
    const [activeTab, setActiveTab] = useState('spectrogram');
    const [selectedChannel, setSelectedChannel] = useState('all');
    const [frequency, setFrequency] = useState('standard'); // standard, delta, theta, alpha, beta, gamma

    // Generate mock data for when real data isn't available
    const mockSpectrogramData = useMemo(() => {
        return generateMockSpectrogram(patientId, recordId);
    }, [patientId, recordId]);

    if (!data) {
        return (
            <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                    <CardTitle className="text-lg">{title || 'EEG Spectrogram'}</CardTitle>
                    <Badge variant="outline">Mock Data</Badge>
                </div>

                <div className="flex justify-between items-center mb-3">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[300px]">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="spectrogram">Spectrogram</TabsTrigger>
                            <TabsTrigger value="waveform">Waveform</TabsTrigger>
                            <TabsTrigger value="3d">3D View</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex gap-2">
                        <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Channel" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Channels</SelectItem>
                                {CHANNEL_COLORS.map(channel => (
                                    <SelectItem key={channel.name} value={channel.name}>
                                        {channel.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={frequency} onValueChange={setFrequency}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Frequency" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="standard">All (0-40Hz)</SelectItem>
                                <SelectItem value="delta">Delta (0.5-4Hz)</SelectItem>
                                <SelectItem value="theta">Theta (4-8Hz)</SelectItem>
                                <SelectItem value="alpha">Alpha (8-13Hz)</SelectItem>
                                <SelectItem value="beta">Beta (13-30Hz)</SelectItem>
                                <SelectItem value="gamma">Gamma (30+ Hz)</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button variant="outline" size="icon">
                            <Download className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <TabsContent value="spectrogram" className="mt-0">
                    <RenderSpectrogram
                        data={mockSpectrogramData}
                        selectedChannel={selectedChannel}
                        frequency={frequency}
                    />
                </TabsContent>

                <TabsContent value="waveform" className="mt-0">
                    <div className="flex flex-col items-center justify-center h-[300px]">
                        <Waveform className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">EEG waveform visualization would appear here</p>
                    </div>
                </TabsContent>

                <TabsContent value="3d" className="mt-0">
                    <div className="flex flex-col items-center justify-center h-[300px]">
                        <Settings className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">3D visualization would appear here</p>
                    </div>
                </TabsContent>
            </div>
        );
    }

    // If we have real data
    return (
        <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
                <CardTitle className="text-lg">{title || 'EEG Spectrogram'}</CardTitle>
                <Badge variant="secondary">Actual Data</Badge>
            </div>

            <div className="flex justify-between items-center mb-3">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[300px]">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="spectrogram">Spectrogram</TabsTrigger>
                        <TabsTrigger value="waveform">Waveform</TabsTrigger>
                        <TabsTrigger value="3d">3D View</TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex gap-2">
                    <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Channel" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Channels</SelectItem>
                            {data.metadata?.channelNames?.map(channel => (
                                <SelectItem key={channel} value={channel}>
                                    {channel}
                                </SelectItem>
                            )) || CHANNEL_COLORS.map(channel => (
                                <SelectItem key={channel.name} value={channel.name}>
                                    {channel.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={frequency} onValueChange={setFrequency}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Frequency" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="standard">All (0-40Hz)</SelectItem>
                            <SelectItem value="delta">Delta (0.5-4Hz)</SelectItem>
                            <SelectItem value="theta">Theta (4-8Hz)</SelectItem>
                            <SelectItem value="alpha">Alpha (8-13Hz)</SelectItem>
                            <SelectItem value="beta">Beta (13-30Hz)</SelectItem>
                            <SelectItem value="gamma">Gamma (30+ Hz)</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button variant="outline" size="icon">
                        <Download className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <TabsContent value="spectrogram" className="mt-0">
                <RenderSpectrogram
                    data={data}
                    selectedChannel={selectedChannel}
                    frequency={frequency}
                />
            </TabsContent>

            <TabsContent value="waveform" className="mt-0">
                <div className="flex flex-col items-center justify-center h-[300px]">
                    <Waveform className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">EEG waveform visualization would appear here</p>
                </div>
            </TabsContent>

            <TabsContent value="3d" className="mt-0">
                <div className="flex flex-col items-center justify-center h-[300px]">
                    <Settings className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">3D visualization would appear here</p>
                </div>
            </TabsContent>
        </div>
    );
};

// Helper to render the spectrogram
interface RenderSpectrogramProps {
    data: ParsedEEGData;
    selectedChannel: string;
    frequency: string;
}

const RenderSpectrogram: React.FC<RenderSpectrogramProps> = ({ data, selectedChannel, frequency }) => {
    // In a real implementation, this would parse the data and create a canvas rendering
    // For now, we'll create a simulated visualization

    // Generate mock spectrograms for each channel or use real data
    const channels = selectedChannel === 'all'
        ? (data.metadata?.channelNames || CHANNEL_COLORS.map(c => c.name))
        : [selectedChannel];

    return (
        <div className="border rounded-lg p-4">
            <div className="mb-4">
                <div className="flex justify-between text-sm text-muted-foreground">
                    <div>Time (seconds)</div>
                    <div>Frequency ({getFrequencyRangeText(frequency)})</div>
                </div>
            </div>

            <ScrollArea className="h-[400px]">
                <div className="space-y-6">
                    {channels.map((channel, idx) => {
                        const colorInfo = CHANNEL_COLORS.find(c => c.name === channel) ||
                                         { name: channel, color: getRandomColor(idx) };

                        return (
                            <div key={channel} className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: colorInfo.color }}
                                    />
                                    <div className="font-medium">{channel}</div>
                                </div>
                                <div
                                    className="h-16 w-full rounded-md overflow-hidden"
                                    style={{
                                        background: `linear-gradient(to right, rgba(0,0,0,0.1), ${colorInfo.color}, rgba(0,0,0,0.1))`,
                                        position: 'relative'
                                    }}
                                >
                                    {/* Simulate frequency bands */}
                                    <div className="absolute inset-0" style={{
                                        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 7px, rgba(255,255,255,0.1) 7px, rgba(255,255,255,0.1) 8px)',
                                    }} />

                                    {/* Simulate time markers */}
                                    <div className="absolute inset-0" style={{
                                        backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(255,255,255,0.1) 19px, rgba(255,255,255,0.1) 20px)',
                                    }} />

                                    {/* Simulate some "hot spots" - these would be where activity is detected */}
                                    {renderHotspots(5, colorInfo.color)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>

            <div className="mt-4">
                <div className="flex justify-between">
                    <div className="text-xs text-muted-foreground">0s</div>
                    <div className="text-xs text-muted-foreground">30s</div>
                </div>

                <div className="mt-2 flex items-center">
                    <div className="text-xs text-muted-foreground mr-2">Power: </div>
                    <div className="w-32 h-4 rounded-sm" style={{
                        background: 'linear-gradient(to right, #1e293b, #3b82f6, #ef4444)'
                    }} />
                    <div className="text-xs ml-2 text-muted-foreground">low → high</div>
                </div>
            </div>
        </div>
    );
};

// Helper function to render "hotspots" in the spectrogram
const renderHotspots = (count: number, baseColor: string) => {
    const spots = [];
    for (let i = 0; i < count; i++) {
        const left = Math.random() * 80 + 10; // 10-90%
        const top = Math.random() * 80 + 10;  // 10-90%
        const size = Math.random() * 15 + 5;  // 5-20px

        spots.push(
            <div
                key={i}
                className="absolute rounded-full"
                style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: `${size}px`,
                    height: `${size}px`,
                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                    boxShadow: `0 0 10px 5px ${baseColor}`,
                    opacity: 0.8,
                }}
            />
        );
    }
    return spots;
};

// Helper to generate mock spectrogram data
const generateMockSpectrogram = (patientId?: string, recordId?: string): ParsedEEGData => {
    // Use patient and record IDs to generate consistent random data
    const seed = `${patientId || ''}${recordId || ''}`.split('').reduce((a, b) => {
        return a + b.charCodeAt(0);
    }, 0);

    // Create a deterministic "random" generator based on seed
    let currentSeed = seed || 0;
    const seededRandom = () => {
        currentSeed = (currentSeed * 9301 + 49297) % 233280;
        return currentSeed / 233280;
    };

    // Generate channel names
    const channelNames = CHANNEL_COLORS.map(c => c.name);

    // Generate mock data structure
    return {
        metadata: {
            recordId: recordId || 'MOCK001',
            patientId: patientId || 'P001',
            channelNames: channelNames,
            samplingRate: 256
        },
        // This would normally be a 3D array: [channels][frequencies][timepoints]
        // For mock data, we'll just create a minimal structure
        data: [[[seededRandom() * 10]]]
    };
};

// Helper function to get a random color
const getRandomColor = (index: number): string => {
    const colors = [
        '#4f46e5', '#2563eb', '#0891b2', '#0d9488',
        '#7c3aed', '#c026d3', '#db2777', '#e11d48',
        '#f59e0b', '#84cc16', '#10b981', '#06b6d4'
    ];
    return colors[index % colors.length];
};

// Helper to get frequency range text
const getFrequencyRangeText = (frequency: string): string => {
    switch (frequency) {
        case 'delta': return '0.5-4Hz';
        case 'theta': return '4-8Hz';
        case 'alpha': return '8-13Hz';
        case 'beta': return '13-30Hz';
        case 'gamma': return '30-40Hz';
        default: return '0-40Hz';
    }
};

export default MultiChannelSpectrogram;
