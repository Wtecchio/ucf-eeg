'use client';

import React, { useEffect, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious
} from '@/components/ui/pagination';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import DashboardTab from './DashboardTab';
import {
    type EEGData,
    type ParsedEEGData,
    type SpectrogramData,
    combineRecordsByEEGSpectrogram,
    fetchCSVFromURL,
    generateSpectrogramData,
    loadSpectrogramById,
    parseCSV,
    parseEEGParquet
} from './parquet-parser';
import MultiChannelSpectrogram from './spectrogram-visualization';
import {
    AlertCircle,
    ArrowDownUp,
    BarChart3,
    Brain,
    Download,
    FileDown,
    FileType,
    RefreshCw,
    Search,
    Settings,
    Upload,
    Users,
    AudioWaveformIcon as Waveform
} from 'lucide-react';

// Mock patient IDs for testing
const patientIds = ['P001', 'P002', 'P003', 'P004', 'P005'];

// CSV data URL - update this with your actual URL
const CSV_URL = '/sample_data/sample_train.csv';

export default function EEGPatientData() {
    const [eegData, setEEGData] = useState<EEGData[]>([]);
    const [multiChannelData, setMultiChannelData] = useState<Record<string, ParsedEEGData>>({});
    const [spectrogramData, setSpectrogramData] = useState<Record<string, SpectrogramData>>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [groupedByPatient, setGroupedByPatient] = useState<Record<string, EEGData[]>>({});
    const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
    const [selectedRecord, setSelectedRecord] = useState<EEGData | null>(null);
    const [modalOpen, setModalOpen] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [recordsPerPage, setRecordsPerPage] = useState<number>(10);
    const [activeTab, setActiveTab] = useState<string>('records');
    const [patientFilter, setPatientFilter] = useState<string>('all');
    const [fileUploaded, setFileUploaded] = useState<boolean>(false);
    const [loadingSpectrogram, setLoadingSpectrogram] = useState<boolean>(false);
    const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
    const [dataSource, setDataSource] = useState<'csv' | 'parquet'>('csv');

    // Function to handle CSV file upload
    const handleCSVFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError(null);

        try {
            const text = await file.text();
            const records = await parseCSV(text);
            processEEGData(records);
            setFileUploaded(true);
            setUploadModalOpen(false);
            setDataSource('csv');
        } catch (err) {
            console.error('Error parsing CSV file:', err);
            setError("Failed to parse CSV file. Please ensure it's a valid CSV format.");
            setLoading(false);
        }
    };

    // Function to handle Parquet file upload
    const handleParquetFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError(null);
        setLoadingSpectrogram(true);

        try {
            const buffer = await file.arrayBuffer();
            const parsedData = await parseEEGParquet(buffer);
            const patientId = parsedData.metadata.patientId || 'unknown';
            setMultiChannelData({
                [patientId]: parsedData
            });

            const mockEEGData: EEGData[] = [
                {
                    eeg_id: parsedData.metadata.recordId || 'EEG1000',
                    eeg_sub_id: 'SUB100',
                    eeg_label_offset_seconds: '0',
                    spectrogram_id: parsedData.metadata.recordId || 'SPEC2000',
                    spectrogram_sub_id: 'SSUB200',
                    spectrogram_label_offset_seconds: '0',
                    label_id: 'L500',
                    patient_id: patientId,
                    expert_consensus: 'Unknown',
                    seizure_vote: '0',
                    lpd_vote: '0',
                    gpd_vote: '0',
                    lrda_vote: '0',
                    grda_vote: '0',
                    other_vote: '0'
                }
            ];

            processEEGData(mockEEGData);
            setFileUploaded(true);
            setUploadModalOpen(false);
            setDataSource('parquet');
        } catch (err) {
            console.error('Error parsing Parquet file:', err);
            setError("Failed to parse Parquet file. Please ensure it's a valid Parquet format.");
            setLoading(false);
            setLoadingSpectrogram(false);
        }
    };

    // Process EEG data after loading
    const processEEGData = (records: EEGData[]) => {
        // First combine the records by EEG/Spectrogram pairs to reduce duplication
        const combinedRecords = combineRecordsByEEGSpectrogram(records);

        setEEGData(combinedRecords);

        // Group by patient ID
        const grouped = combinedRecords.reduce<Record<string, EEGData[]>>((acc, curr) => {
            if (!curr.patient_id) return acc;
            if (!acc[curr.patient_id]) acc[curr.patient_id] = [];
            acc[curr.patient_id].push(curr);
            return acc;
        }, {});

        setGroupedByPatient(grouped);

        if (dataSource === 'csv') {
            const mockSpectrogramData: Record<string, SpectrogramData> = {};
            combinedRecords.forEach((record) => {
                if (record.patient_id && record.eeg_id) {
                    const key = `${record.patient_id}_${record.eeg_id}`;
                    mockSpectrogramData[key] = generateSpectrogramData(record.patient_id, record.eeg_id);
                }
            });
            setSpectrogramData(mockSpectrogramData);
        }


        setLoading(false);
        setLoadingSpectrogram(false);
    };

    // Load data from CSV URL or Parquet files
    // Data loading effect
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);

                // First try to load data from CSV
                try {
                    const records = await fetchCSVFromURL(CSV_URL);
                    if (records && records.length > 0) {
                        console.log(`Successfully loaded ${records.length} records from CSV`);

                        // Process the CSV records
                        processEEGData(records);

                        // Now load the spectrograms asynchronously without waiting for them to finish
                        loadAllSpectrograms(records);
                        return;
                    }
                } catch (csvErr) {
                    console.warn('Could not load CSV from URL:', csvErr);
                }

                // If CSV load fails, generate mock data as fallback
                console.log('Generating mock data as fallback');
                const mockData: EEGData[] = [];

                // Use more realistic IDs for the mock data
                const mockEegIds = ['EEG001', 'EEG002', 'EEG003', 'EEG004', 'EEG005'];
                const mockSpectrogramIds = ['SPEC001', 'SPEC002', 'SPEC003', 'SPEC004', 'SPEC005'];

                for (let i = 0; i < patientIds.length; i++) {
                    const patientId = patientIds[i];
                    const mockEegId = mockEegIds[i] || `EEG${i}`;
                    const mockSpectrogramId = mockSpectrogramIds[i] || `SPEC${i}`;

                    for (let j = 0; j < 5; j++) {
                        mockData.push({
                            eeg_id: `${mockEegId}_${j}`,
                            eeg_sub_id: `SUB${i}${j}`,
                            eeg_label_offset_seconds: (j * 2).toString(),
                            spectrogram_id: `${mockSpectrogramId}_${j}`,
                            spectrogram_sub_id: `SSUB${i}${j}`,
                            spectrogram_label_offset_seconds: (j * 2).toString(),
                            label_id: `L${i}${j}`,
                            patient_id: patientId,
                            expert_consensus: ['Seizure', 'LPD', 'GPD', 'LRDA', 'GRDA'][Math.floor(Math.random() * 5)],
                            seizure_vote: Math.random() > 0.7 ? Math.floor(Math.random() * 10).toString() : '0',
                            lpd_vote: Math.random() > 0.7 ? Math.floor(Math.random() * 10).toString() : '0',
                            gpd_vote: Math.random() > 0.7 ? Math.floor(Math.random() * 10).toString() : '0',
                            lrda_vote: Math.random() > 0.7 ? Math.floor(Math.random() * 10).toString() : '0',
                            grda_vote: Math.random() > 0.7 ? Math.floor(Math.random() * 10).toString() : '0',
                            other_vote: Math.random() > 0.7 ? Math.floor(Math.random() * 10).toString() : '0'
                        });
                    }
                }

                processEEGData(mockData);
                setDataSource('csv');
            } catch (error) {
                console.error('Error loading data:', error);
                setError('Failed to load data. Please try uploading a file manually.');
            } finally {
                setLoading(false);
            }
        };

        // Helper function to load spectrograms
        const loadAllSpectrograms = async (records: EEGData[]) => {
            setLoadingSpectrogram(true);

            // Get all unique spectrogram IDs from the records
            const allSpectrogramIds = [...new Set(records.map((r) => r.spectrogram_id))];
            console.log(`Found ${allSpectrogramIds.length} unique spectrogram IDs`);

            // Take a reasonable sample (for instance, first 20)
            const spectrogramSample = allSpectrogramIds.slice(0, 20);
            console.log(`Will check for ${spectrogramSample.length} spectrograms:`, spectrogramSample);

            let parquetLoaded = false;

            for (const spectrogramId of spectrogramSample) {
                if (!spectrogramId) continue;

                try {
                    // Check if the spectrogram file exists
                    const specUrl = `/sample_data/spectrograms/${spectrogramId}.parquet`;
                    console.log(`Checking for spectrogram: ${specUrl}`);

                    const headRes = await fetch(specUrl, { method: 'HEAD' });
                    if (headRes.ok) {
                        console.log(`Found spectrogram file: ${spectrogramId}.parquet`);

                        // Load the spectrogram data
                        const spectroData = await loadSpectrogramById(spectrogramId);
                        if (spectroData) {
                            console.log(`Loaded spectrogram data for ID: ${spectrogramId}`);
                            setMultiChannelData((prev) => ({ ...prev, [spectrogramId]: spectroData }));
                            parquetLoaded = true;
                        }
                    }
                } catch (err) {
                    console.warn(`Could not load spectrogram data for ID ${spectrogramId}:`, err);
                }
            }

            if (parquetLoaded) {
                setDataSource('parquet');
            }

            setLoadingSpectrogram(false);
        };

        loadData();
    }, []);

    // Effect to log details on patient selection changes
    useEffect(() => {
        if (!selectedPatient || !groupedByPatient[selectedPatient]) return;

        console.log(`Selected patient changed to: ${selectedPatient}`);
        console.log(`Available spectrogram IDs:`, Object.keys(multiChannelData));

        const patientRecords = groupedByPatient[selectedPatient];
        const neededSpectrogramIds = [...new Set(patientRecords.map((r) => r.spectrogram_id))];
        console.log(`This patient needs spectrograms:`, neededSpectrogramIds);

        const missingIds = neededSpectrogramIds.filter((id) => !multiChannelData[id]);
        console.log(`Missing spectrograms:`, missingIds);

        // You can add additional loading logic here for missing spectrograms if needed
    }, [selectedPatient, groupedByPatient, multiChannelData]);

    // Filter patients based on search query
    const filteredPatients = useMemo(() => {
        if (!searchQuery.trim()) return Object.keys(groupedByPatient);
        return Object.keys(groupedByPatient).filter((patientId) =>
            patientId.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [groupedByPatient, searchQuery]);

    // Get patient records with sorting and filtering
    const patientRecords = useMemo(() => {
        if (!selectedPatient) return [];
        let records = [...groupedByPatient[selectedPatient]];
        if (patientFilter !== 'all') {
            records = records.filter((record) => record.expert_consensus.toLowerCase() === patientFilter.toLowerCase());
        }
        if (sortColumn) {
            records.sort((a, b) => {
                const aValue = a[sortColumn as keyof EEGData] || '';
                const bValue = b[sortColumn as keyof EEGData] || '';
                return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            });
        }
        return records;
    }, [selectedPatient, groupedByPatient, sortColumn, sortDirection, patientFilter]);

    // Pagination
    const paginatedRecords = useMemo(() => {
        const startIndex = (currentPage - 1) * recordsPerPage;
        return patientRecords.slice(startIndex, startIndex + recordsPerPage);
    }, [patientRecords, currentPage, recordsPerPage]);

    const totalPages = useMemo(
        () => Math.ceil(patientRecords.length / recordsPerPage),
        [patientRecords, recordsPerPage]
    );

    // Effect to log details on patient selection changes and load missing spectrograms
    useEffect(() => {
        if (!selectedPatient || !groupedByPatient[selectedPatient]) return;

        console.log(`Selected patient changed to: ${selectedPatient}`);
        console.log(`Available spectrogram IDs:`, Object.keys(multiChannelData));

        // Determine which spectrograms are needed for this patient
        const patientRecords = groupedByPatient[selectedPatient];
        const neededSpectrogramIds = [...new Set(patientRecords.map((r) => r.spectrogram_id))];
        console.log(`This patient needs spectrograms:`, neededSpectrogramIds);

        // Identify the missing spectrograms
        const missingIds = neededSpectrogramIds.filter((id) => !multiChannelData[id]);
        console.log(`Missing spectrograms:`, missingIds);

        // Load the missing spectrograms
        if (missingIds.length > 0) {
            const loadMissingSpectrograms = async () => {
                setLoadingSpectrogram(true);
                let loadedAny = false;

                for (const spectrogramId of missingIds) {
                    if (!spectrogramId) continue;

                    try {
                        // Check if the spectrogram file exists
                        const specUrl = `/sample_data/spectrograms/${spectrogramId}.parquet`;
                        console.log(`Checking for missing spectrogram: ${specUrl}`);

                        const headRes = await fetch(specUrl, { method: 'HEAD' });
                        if (headRes.ok) {
                            console.log(`Found missing spectrogram file: ${spectrogramId}.parquet`);
                            const data = await loadSpectrogramById(spectrogramId);
                            if (data) {
                                console.log(`Loaded missing spectrogram ${spectrogramId}`);
                                setMultiChannelData((prev) => ({ ...prev, [spectrogramId]: data }));
                                loadedAny = true;
                            }
                        } else {
                            console.warn(`Missing spectrogram file not found: ${specUrl}`);
                        }
                    } catch (err) {
                        console.warn(`Failed to load missing spectrogram ${spectrogramId}:`, err);
                    }
                }

                setLoadingSpectrogram(false);
                if (!loadedAny) {
                    console.log('No missing spectrograms could be loaded for this patient');
                }
            };

            loadMissingSpectrograms();
        }
    }, [selectedPatient, groupedByPatient, multiChannelData]);

    // Calculate patient statistics for dashboard
    const patientStats = useMemo((): {
        totalRecords: number;
        consensusDistribution: Record<string, number>;
        voteDistribution: Record<string, number>;
    } | null => {
        if (!selectedPatient) return null;
        const records = groupedByPatient[selectedPatient];
        const totalRecords = records.length;
        const consensusDistribution = records.reduce<Record<string, number>>((acc, record) => {
            const consensus = record.expert_consensus;
            if (!acc[consensus]) acc[consensus] = 0;
            acc[consensus]++;
            return acc;
        }, {});
        const voteDistribution = {
            seizure: records.reduce((sum, record) => sum + Number(record.seizure_vote), 0),
            lpd: records.reduce((sum, record) => sum + Number(record.lpd_vote), 0),
            gpd: records.reduce((sum, record) => sum + Number(record.gpd_vote), 0),
            lrda: records.reduce((sum, record) => sum + Number(record.lrda_vote), 0),
            grda: records.reduce((sum, record) => sum + Number(record.grda_vote), 0),
            other: records.reduce((sum, record) => sum + Number(record.other_vote), 0)
        };
        return { totalRecords, consensusDistribution, voteDistribution };
    }, [selectedPatient, groupedByPatient]);

    const handleRecordClick = (record: EEGData) => {
        setSelectedRecord(record);
        setModalOpen(true);
    };

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const exportData = (format: 'csv' | 'json') => {
        if (!selectedPatient) return;
        const records = groupedByPatient[selectedPatient];
        let content: string, filename: string;
        if (format === 'csv') {
            const headers = Object.keys(records[0]).join(',');
            const rows = records
                .map((record) =>
                    Object.values(record)
                        .map((value) => `"${value}"`)
                        .join(',')
                )
                .join('\n');
            content = `${headers}\n${rows}`;
            filename = `patient_${selectedPatient}_data.csv`;
        } else {
            content = JSON.stringify(records, null, 2);
            filename = `patient_${selectedPatient}_data.json`;
        }
        const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const getConsensusColor = (consensus: string): 'destructive' | 'secondary' | 'default' | 'outline' => {
        switch (consensus.toLowerCase()) {
            case 'seizure':
                return 'destructive';
            case 'grda':
                return 'secondary';
            case 'lpd':
                return 'default';
            case 'gpd':
                return 'outline';
            case 'lrda':
                return 'secondary';
            default:
                return 'default';
        }
    };

    const getMultiChannelData = (patientId: string): ParsedEEGData | null => {
        return multiChannelData[patientId] || null;
    };

    const getSpectrogramData = (patientId: string, eegId: string): SpectrogramData | null => {
        const key = `${patientId}_${eegId}`;
        return spectrogramData[key] || null;
    };

    if (loading) {
        return (
            <div className='container mx-auto flex h-screen items-center justify-center p-6'>
                <Card className='w-full max-w-6xl'>
                    <CardHeader>
                        <CardTitle>EEG Patient Data</CardTitle>
                        <CardDescription>Loading patient information...</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className='flex flex-col gap-6 md:flex-row'>
                            <div className='w-full space-y-2 md:w-1/4'>
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <Skeleton key={i} className='h-10 w-full' />
                                ))}
                            </div>
                            <div className='w-full md:w-3/4'>
                                <Skeleton className='mb-4 h-8 w-full' />
                                <Skeleton className='h-64 w-full' />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <div className='container mx-auto flex h-screen items-center justify-center p-6'>
                <Alert variant='destructive' className='max-w-md'>
                    <AlertCircle className='h-4 w-4' />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className='container mx-auto p-6'>
            <Card className='w-full'>
                <CardHeader className='flex flex-row items-center justify-between'>
                    <div>
                        <CardTitle className='flex items-center gap-2'>
                            <Brain className='h-6 w-6' /> EEG Patient Data
                        </CardTitle>
                        <CardDescription>
                            View and analyze electroencephalogram data by patient{' '}
                            {dataSource === 'parquet' && ' (Multi-Channel Parquet)'}
                            {dataSource === 'csv' && ' (CSV)'}
                        </CardDescription>
                    </div>
                    <div className='flex items-center gap-2'>
                        <Button variant='outline' onClick={() => setUploadModalOpen(true)}>
                            <Upload className='mr-2 h-4 w-4' /> Upload Data
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant='outline' size='icon'>
                                    <Settings className='h-4 w-4' />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setRecordsPerPage(5)}>
                                    Show 5 records per page
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setRecordsPerPage(10)}>
                                    Show 10 records per page
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setRecordsPerPage(20)}>
                                    Show 20 records per page
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className='flex flex-col gap-6 md:flex-row'>
                        {/* Patient List Panel */}
                        <Card className='w-full md:w-1/4'>
                            <CardHeader className='pb-3'>
                                <CardTitle className='flex items-center gap-2 text-lg'>
                                    <Users className='h-4 w-4' /> Patients
                                </CardTitle>
                                <div className='relative mt-2'>
                                    <Search className='text-muted-foreground absolute top-2.5 left-2 h-4 w-4' />
                                    <Input
                                        placeholder='Search patients...'
                                        className='pl-8'
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className='p-0'>
                                <ScrollArea className='h-[calc(100vh-350px)]'>
                                    <div className='space-y-2 p-4'>
                                        {filteredPatients.length === 0 ? (
                                            <p className='text-muted-foreground py-4 text-center'>No patients found</p>
                                        ) : (
                                            filteredPatients.map((patientId) => (
                                                <button
                                                    key={patientId}
                                                    onClick={() => {
                                                        setSelectedPatient(patientId);
                                                        setCurrentPage(1);
                                                        setActiveTab('records');
                                                    }}
                                                    className={`flex w-full items-center justify-between rounded-md p-3 text-left transition-colors ${
                                                        selectedPatient === patientId
                                                            ? 'bg-primary text-primary-foreground'
                                                            : 'hover:bg-muted'
                                                    }`}>
                                                    <span>Patient {patientId}</span>
                                                    <Badge variant='outline'>
                                                        {groupedByPatient[patientId].length}
                                                    </Badge>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                            <CardFooter className='flex justify-center pt-3 pb-4'>
                                <Badge variant='outline' className='px-3'>
                                    {Object.keys(groupedByPatient).length} Patients Total
                                </Badge>
                            </CardFooter>
                        </Card>

                        {/* Patient Data Panel */}
                        <Card className='w-full md:w-3/4'>
                            <CardContent className='p-6'>
                                {!selectedPatient ? (
                                    <div className='flex h-[calc(100vh-300px)] flex-col items-center justify-center gap-4'>
                                        <Brain className='text-muted-foreground/50 h-16 w-16' />
                                        <p className='text-muted-foreground text-center'>
                                            Select a patient from the list to view their EEG data
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                                            <div>
                                                <h2 className='flex items-center gap-2 text-2xl font-bold'>
                                                    Patient {selectedPatient}
                                                </h2>
                                                <p className='text-muted-foreground'>
                                                    {patientRecords.length} Records{' '}
                                                    {patientFilter !== 'all' && `(filtered)`}
                                                </p>
                                            </div>
                                            <div className='flex flex-wrap gap-2'>
                                                <Select value={patientFilter} onValueChange={setPatientFilter}>
                                                    <SelectTrigger className='w-[180px]'>
                                                        <SelectValue placeholder='Filter by consensus' />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value='all'>All Consensus Types</SelectItem>
                                                        <SelectItem value='seizure'>Seizure</SelectItem>
                                                        <SelectItem value='lpd'>LPD</SelectItem>
                                                        <SelectItem value='gpd'>GPD</SelectItem>
                                                        <SelectItem value='lrda'>LRDA</SelectItem>
                                                        <SelectItem value='grda'>GRDA</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant='outline' className='gap-1'>
                                                            <FileDown className='h-4 w-4' /> Export
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align='end'>
                                                        <DropdownMenuItem onClick={() => exportData('csv')}>
                                                            <Download className='mr-2 h-4 w-4' /> Export as CSV
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => exportData('json')}>
                                                            <Download className='mr-2 h-4 w-4' /> Export as JSON
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                        <Tabs value={activeTab} onValueChange={setActiveTab} className='mb-6'>
                                            <TabsList>
                                                <TabsTrigger value='records'>Records</TabsTrigger>
                                                <TabsTrigger value='spectrograms'>Spectrograms</TabsTrigger>
                                                <TabsTrigger value='dashboard'>Dashboard</TabsTrigger>
                                            </TabsList>
                                            {/* Records Tab */}
                                            <TabsContent value='records' className='mt-4'>
                                                <ScrollArea className='h-[calc(100vh-450px)]'>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead
                                                                    className='hover:text-primary cursor-pointer'
                                                                    onClick={() => handleSort('eeg_id')}>
                                                                    <div className='flex items-center gap-1'>
                                                                        EEG ID
                                                                        {sortColumn === 'eeg_id' && (
                                                                            <ArrowDownUp className='h-3 w-3' />
                                                                        )}
                                                                    </div>
                                                                </TableHead>
                                                                <TableHead
                                                                    className='hover:text-primary cursor-pointer'
                                                                    onClick={() => handleSort('spectrogram_id')}>
                                                                    <div className='flex items-center gap-1'>
                                                                        Spectrogram ID
                                                                        {sortColumn === 'spectrogram_id' && (
                                                                            <ArrowDownUp className='h-3 w-3' />
                                                                        )}
                                                                    </div>
                                                                </TableHead>
                                                                <TableHead
                                                                    className='hover:text-primary cursor-pointer'
                                                                    onClick={() =>
                                                                        handleSort('eeg_label_offset_seconds')
                                                                    }>
                                                                    <div className='flex items-center gap-1'>
                                                                        Offset (sec)
                                                                        {sortColumn === 'eeg_label_offset_seconds' && (
                                                                            <ArrowDownUp className='h-3 w-3' />
                                                                        )}
                                                                    </div>
                                                                </TableHead>
                                                                <TableHead
                                                                    className='hover:text-primary cursor-pointer'
                                                                    onClick={() => handleSort('expert_consensus')}>
                                                                    <div className='flex items-center gap-1'>
                                                                        Expert Consensus
                                                                        {sortColumn === 'expert_consensus' && (
                                                                            <ArrowDownUp className='h-3 w-3' />
                                                                        )}
                                                                    </div>
                                                                </TableHead>
                                                                <TableHead>Votes</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {paginatedRecords.length === 0 ? (
                                                                <TableRow>
                                                                    <TableCell colSpan={5} className='py-8 text-center'>
                                                                        No records found
                                                                        {patientFilter !== 'all' && (
                                                                            <div className='mt-2'>
                                                                                <Button
                                                                                    variant='link'
                                                                                    onClick={() =>
                                                                                        setPatientFilter('all')
                                                                                    }>
                                                                                    Clear filter
                                                                                </Button>
                                                                            </div>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ) : (
                                                                paginatedRecords.map((record, idx) => (
                                                                    <TableRow
                                                                        key={idx}
                                                                        className='hover:bg-muted/50 cursor-pointer'
                                                                        onClick={() => handleRecordClick(record)}>
                                                                        <TableCell>{record.eeg_id}</TableCell>
                                                                        <TableCell>{record.spectrogram_id}</TableCell>
                                                                        <TableCell>
                                                                            {record.offsets ? (
                                                                                <div className='flex flex-wrap gap-1'>
                                                                                    {record.offsets.map((offset, i) => (
                                                                                        <Badge
                                                                                            key={i}
                                                                                            variant='outline'
                                                                                            className='text-xs'>
                                                                                            {offset.toFixed(1)}s
                                                                                        </Badge>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                record.eeg_label_offset_seconds
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <div className='flex flex-wrap gap-1'>
                                                                                {Number(record.seizure_vote) > 0 && (
                                                                                    <Badge
                                                                                        variant='default'
                                                                                        className='bg-red-500 text-xs text-white hover:bg-red-600'>
                                                                                        Seizure: {record.seizure_vote}
                                                                                    </Badge>
                                                                                )}
                                                                                {Number(record.lpd_vote) > 0 && (
                                                                                    <Badge
                                                                                        variant='default'
                                                                                        className='bg-orange-500 text-xs text-white hover:bg-orange-600'>
                                                                                        LPD: {record.lpd_vote}
                                                                                    </Badge>
                                                                                )}
                                                                                {Number(record.gpd_vote) > 0 && (
                                                                                    <Badge
                                                                                        variant='default'
                                                                                        className='bg-yellow-500 text-xs text-black hover:bg-yellow-600'>
                                                                                        GPD: {record.gpd_vote}
                                                                                    </Badge>
                                                                                )}
                                                                                {Number(record.lrda_vote) > 0 && (
                                                                                    <Badge
                                                                                        variant='default'
                                                                                        className='bg-green-500 text-xs text-white hover:bg-green-600'>
                                                                                        LRDA: {record.lrda_vote}
                                                                                    </Badge>
                                                                                )}
                                                                                {Number(record.grda_vote) > 0 && (
                                                                                    <Badge
                                                                                        variant='default'
                                                                                        className='bg-amber-500 text-xs text-black hover:bg-amber-600'>
                                                                                        GRDA: {record.grda_vote}
                                                                                    </Badge>
                                                                                )}
                                                                                {Number(record.other_vote) > 0 && (
                                                                                    <Badge
                                                                                        variant='secondary'
                                                                                        className='text-xs'>
                                                                                        Other: {record.other_vote}
                                                                                    </Badge>
                                                                                )}
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                </ScrollArea>
                                                {paginatedRecords.length > 0 && (
                                                    <div className='mt-4 flex items-center justify-between'>
                                                        <div className='text-muted-foreground text-sm'>
                                                            Showing {(currentPage - 1) * recordsPerPage + 1} to{' '}
                                                            {Math.min(
                                                                currentPage * recordsPerPage,
                                                                patientRecords.length
                                                            )}{' '}
                                                            of {patientRecords.length} records
                                                        </div>
                                                        <Pagination>
                                                            <PaginationContent>
                                                                <PaginationItem>
                                                                    <PaginationPrevious
                                                                        onClick={() =>
                                                                            setCurrentPage((p) => Math.max(1, p - 1))
                                                                        }
                                                                        className={
                                                                            currentPage === 1
                                                                                ? 'pointer-events-none opacity-50'
                                                                                : ''
                                                                        }
                                                                    />
                                                                </PaginationItem>
                                                                {currentPage > 3 && (
                                                                    <PaginationItem>
                                                                        <PaginationLink
                                                                            onClick={() => setCurrentPage(1)}>
                                                                            1
                                                                        </PaginationLink>
                                                                    </PaginationItem>
                                                                )}
                                                                {currentPage > 4 && (
                                                                    <PaginationItem>
                                                                        <PaginationEllipsis />
                                                                    </PaginationItem>
                                                                )}
                                                                {Array.from(
                                                                    { length: Math.min(3, totalPages) },
                                                                    (_, i) => {
                                                                        const pageNum = Math.min(
                                                                            Math.max(currentPage - 1, 1) + i,
                                                                            totalPages
                                                                        );
                                                                        if (
                                                                            (currentPage > 3 && pageNum === 1) ||
                                                                            (currentPage < totalPages - 2 &&
                                                                                pageNum === totalPages)
                                                                        ) {
                                                                            return null;
                                                                        }
                                                                        return (
                                                                            <PaginationItem key={pageNum}>
                                                                                <PaginationLink
                                                                                    onClick={() =>
                                                                                        setCurrentPage(pageNum)
                                                                                    }
                                                                                    isActive={currentPage === pageNum}>
                                                                                    {pageNum}
                                                                                </PaginationLink>
                                                                            </PaginationItem>
                                                                        );
                                                                    }
                                                                )}
                                                                {currentPage < totalPages - 3 && (
                                                                    <PaginationItem>
                                                                        <PaginationEllipsis />
                                                                    </PaginationItem>
                                                                )}
                                                                {totalPages > 3 && currentPage < totalPages - 2 && (
                                                                    <PaginationItem>
                                                                        <PaginationLink
                                                                            onClick={() => setCurrentPage(totalPages)}>
                                                                            {totalPages}
                                                                        </PaginationLink>
                                                                    </PaginationItem>
                                                                )}
                                                                <PaginationItem>
                                                                    <PaginationNext
                                                                        onClick={() =>
                                                                            setCurrentPage((p) =>
                                                                                Math.min(totalPages, p + 1)
                                                                            )
                                                                        }
                                                                        className={
                                                                            currentPage === totalPages
                                                                                ? 'pointer-events-none opacity-50'
                                                                                : ''
                                                                        }
                                                                    />
                                                                </PaginationItem>
                                                            </PaginationContent>
                                                        </Pagination>
                                                    </div>
                                                )}
                                            </TabsContent>

                                            {/* Spectrograms Tab */}
                                            {/* This code goes in the Spectrograms Tab section of your main EEGPatientData component */}
                                            <TabsContent value='spectrograms' className='mt-4'>
                                                {patientRecords.length === 0 ? (
                                                    <div className='flex h-[300px] flex-col items-center justify-center gap-4'>
                                                        <Waveform className='text-muted-foreground/50 h-16 w-16' />
                                                        <p className='text-muted-foreground text-center'>
                                                            No records found for this patient
                                                        </p>
                                                    </div>
                                                ) : loadingSpectrogram ? (
                                                    <div className='flex h-[300px] flex-col items-center justify-center gap-4'>
                                                        <RefreshCw className='text-primary h-16 w-16 animate-spin' />
                                                        <p className='text-muted-foreground text-center'>
                                                            Loading spectrogram data...
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className='space-y-6'>
                                                        {paginatedRecords.map((record, idx) => {
                                                            const spectrogramId = record.spectrogram_id;
                                                            const hasParquetData =
                                                                multiChannelData[spectrogramId] !== undefined;

                                                            return (
                                                                <div key={idx} className='rounded-lg border p-4'>
                                                                    <div className='mb-4 flex items-center justify-between'>
                                                                        <h3 className='text-lg font-medium'>
                                                                            Record: {record.eeg_id}
                                                                            {hasParquetData && (
                                                                                <span className='ml-2 text-sm text-green-600'>
                                                                                    (Parquet Data Available)
                                                                                </span>
                                                                            )}
                                                                        </h3>
                                                                        <Badge
                                                                            variant={getConsensusColor(
                                                                                record.expert_consensus
                                                                            )}>
                                                                            {record.expert_consensus}
                                                                        </Badge>
                                                                    </div>

                                                                    {/* Pass the offsets array to the MultiChannelSpectrogram component */}
                                                                    <MultiChannelSpectrogram
                                                                        data={
                                                                            hasParquetData
                                                                                ? multiChannelData[spectrogramId]
                                                                                : null
                                                                        }
                                                                        title={`Spectrogram for ID: ${spectrogramId}`}
                                                                        patientId={record.patient_id}
                                                                        recordId={record.eeg_id}
                                                                        offsets={record.offsets} // Pass the offsets array here
                                                                    />
                                                                </div>
                                                            );
                                                        })}

                                                        {paginatedRecords.length > 0 && (
                                                            <div className='mt-4 flex items-center justify-between'>
                                                                <div className='text-muted-foreground text-sm'>
                                                                    Showing {(currentPage - 1) * recordsPerPage + 1} to{' '}
                                                                    {Math.min(
                                                                        currentPage * recordsPerPage,
                                                                        patientRecords.length
                                                                    )}{' '}
                                                                    of {patientRecords.length} records
                                                                </div>
                                                                <Pagination>
                                                                    <PaginationContent>
                                                                        <PaginationItem>
                                                                            <PaginationPrevious
                                                                                onClick={() =>
                                                                                    setCurrentPage((p) =>
                                                                                        Math.max(1, p - 1)
                                                                                    )
                                                                                }
                                                                                className={
                                                                                    currentPage === 1
                                                                                        ? 'pointer-events-none opacity-50'
                                                                                        : ''
                                                                                }
                                                                            />
                                                                        </PaginationItem>
                                                                        {currentPage > 3 && (
                                                                            <PaginationItem>
                                                                                <PaginationLink
                                                                                    onClick={() => setCurrentPage(1)}>
                                                                                    1
                                                                                </PaginationLink>
                                                                            </PaginationItem>
                                                                        )}
                                                                        {currentPage > 4 && (
                                                                            <PaginationItem>
                                                                                <PaginationEllipsis />
                                                                            </PaginationItem>
                                                                        )}
                                                                        {Array.from(
                                                                            { length: Math.min(3, totalPages) },
                                                                            (_, i) => {
                                                                                const pageNum = Math.min(
                                                                                    Math.max(currentPage - 1, 1) + i,
                                                                                    totalPages
                                                                                );
                                                                                if (
                                                                                    (currentPage > 3 &&
                                                                                        pageNum === 1) ||
                                                                                    (currentPage < totalPages - 2 &&
                                                                                        pageNum === totalPages)
                                                                                ) {
                                                                                    return null;
                                                                                }
                                                                                return (
                                                                                    <PaginationItem key={pageNum}>
                                                                                        <PaginationLink
                                                                                            onClick={() =>
                                                                                                setCurrentPage(pageNum)
                                                                                            }
                                                                                            isActive={
                                                                                                currentPage === pageNum
                                                                                            }>
                                                                                            {pageNum}
                                                                                        </PaginationLink>
                                                                                    </PaginationItem>
                                                                                );
                                                                            }
                                                                        )}
                                                                        {currentPage < totalPages - 3 && (
                                                                            <PaginationItem>
                                                                                <PaginationEllipsis />
                                                                            </PaginationItem>
                                                                        )}
                                                                        {totalPages > 3 &&
                                                                            currentPage < totalPages - 2 && (
                                                                                <PaginationItem>
                                                                                    <PaginationLink
                                                                                        onClick={() =>
                                                                                            setCurrentPage(totalPages)
                                                                                        }>
                                                                                        {totalPages}
                                                                                    </PaginationLink>
                                                                                </PaginationItem>
                                                                            )}
                                                                        <PaginationItem>
                                                                            <PaginationNext
                                                                                onClick={() =>
                                                                                    setCurrentPage((p) =>
                                                                                        Math.min(totalPages, p + 1)
                                                                                    )
                                                                                }
                                                                                className={
                                                                                    currentPage === totalPages
                                                                                        ? 'pointer-events-none opacity-50'
                                                                                        : ''
                                                                                }
                                                                            />
                                                                        </PaginationItem>
                                                                    </PaginationContent>
                                                                </Pagination>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </TabsContent>
                                            {/* Dashboard Tab */}
                                            <TabsContent value='dashboard' className='mt-4'>
                                                <DashboardTab
                                                    selectedPatient={selectedPatient}
                                                    patientCombinedRecords={
                                                        selectedPatient ? groupedByPatient[selectedPatient] || [] : []
                                                    }
                                                    multiChannelData={multiChannelData}
                                                    dataSource={dataSource}
                                                />
                                            </TabsContent>
                                        </Tabs>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>

            {/* Upload Data Modal */}
            <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
                <DialogContent className='sm:max-w-[500px]'>
                    <DialogHeader>
                        <DialogTitle>Upload EEG Data</DialogTitle>
                        <DialogDescription>Upload CSV or Parquet files containing EEG data</DialogDescription>
                    </DialogHeader>
                    <div className='grid gap-6 py-4'>
                        <div className='space-y-4'>
                            <div className='flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6'>
                                <FileType className='text-muted-foreground mb-4 h-10 w-10' />
                                <p className='text-muted-foreground mb-4 text-center text-sm'>Upload EEG data file</p>
                                <div className='flex flex-wrap gap-2'>
                                    <label htmlFor='csv-file-upload'>
                                        <input
                                            id='csv-file-upload'
                                            type='file'
                                            accept='.csv'
                                            className='hidden'
                                            onChange={handleCSVFileUpload}
                                        />
                                        <Button variant='outline' className='cursor-pointer'>
                                            Select CSV File
                                        </Button>
                                    </label>
                                    <label htmlFor='parquet-file-upload'>
                                        <input
                                            id='parquet-file-upload'
                                            type='file'
                                            accept='.parquet'
                                            className='hidden'
                                            onChange={handleParquetFileUpload}
                                        />
                                        <Button variant='outline' className='cursor-pointer'>
                                            Select Parquet File
                                        </Button>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => setUploadModalOpen(false)}>
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Record Details Modal */}
            {/* Record Details Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className='sm:max-w-[800px]'>
                    <DialogHeader>
                        <DialogTitle>EEG Record Details</DialogTitle>
                        <DialogDescription>Detailed information about the selected EEG recording</DialogDescription>
                    </DialogHeader>
                    {selectedRecord && (
                        <div className='grid gap-4'>
                            <Tabs defaultValue='details'>
                                <TabsList className='grid w-full grid-cols-3'>
                                    <TabsTrigger value='details'>Details</TabsTrigger>
                                    <TabsTrigger value='votes'>Votes Analysis</TabsTrigger>
                                    <TabsTrigger value='spectrogram'>Spectrogram</TabsTrigger>
                                </TabsList>
                                <TabsContent value='details' className='space-y-4 pt-4'>
                                    {/* Details content - keep this part as is */}
                                    <div className='grid grid-cols-2 gap-4'>
                                        <div>
                                            <h3 className='text-muted-foreground text-sm font-medium'>Patient ID</h3>
                                            <p className='font-semibold'>{selectedRecord.patient_id}</p>
                                        </div>
                                        <div>
                                            <h3 className='text-muted-foreground text-sm font-medium'>
                                                Expert Consensus
                                            </h3>
                                            <Badge
                                                variant={getConsensusColor(selectedRecord.expert_consensus)}
                                                className='mt-1'>
                                                {selectedRecord.expert_consensus}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className='grid grid-cols-2 gap-4'>
                                        <div>
                                            <h3 className='text-muted-foreground text-sm font-medium'>EEG ID</h3>
                                            <p>{selectedRecord.eeg_id}</p>
                                        </div>
                                        <div>
                                            <h3 className='text-muted-foreground text-sm font-medium'>EEG Sub ID</h3>
                                            <p>{selectedRecord.eeg_sub_id}</p>
                                        </div>
                                    </div>
                                    <div className='grid grid-cols-2 gap-4'>
                                        <div>
                                            <h3 className='text-muted-foreground text-sm font-medium'>
                                                Spectrogram ID
                                            </h3>
                                            <p>{selectedRecord.spectrogram_id}</p>
                                        </div>
                                        <div>
                                            <h3 className='text-muted-foreground text-sm font-medium'>
                                                Spectrogram Sub ID
                                            </h3>
                                            <p>{selectedRecord.spectrogram_sub_id}</p>
                                        </div>
                                    </div>
                                    <div className='grid grid-cols-2 gap-4'>
                                        <div>
                                            <h3 className='text-muted-foreground text-sm font-medium'>
                                                EEG Offset (sec)
                                            </h3>
                                            <p>{selectedRecord.eeg_label_offset_seconds}</p>
                                        </div>
                                        <div>
                                            <h3 className='text-muted-foreground text-sm font-medium'>
                                                Spectrogram Offset (sec)
                                            </h3>
                                            <p>{selectedRecord.spectrogram_label_offset_seconds}</p>
                                        </div>
                                    </div>
                                </TabsContent>
                                <TabsContent value='votes' className='pt-4'>
                                    {/* Votes analysis content - keep this part as is */}
                                    <h3 className='text-muted-foreground mb-3 text-sm font-medium'>
                                        Vote Distribution
                                    </h3>
                                    <div className='grid grid-cols-3 gap-3'>
                                        {Number(selectedRecord.seizure_vote) > 0 && (
                                            <div className='rounded-md border bg-red-50 p-3 dark:bg-red-900/20'>
                                                <p className='text-muted-foreground text-xs'>Seizure</p>
                                                <p className='text-2xl font-bold text-red-600 dark:text-red-400'>
                                                    {selectedRecord.seizure_vote}
                                                </p>
                                            </div>
                                        )}
                                        {Number(selectedRecord.lpd_vote) > 0 && (
                                            <div className='rounded-md border bg-orange-50 p-3 dark:bg-orange-900/20'>
                                                <p className='text-muted-foreground text-xs'>LPD</p>
                                                <p className='text-2xl font-bold text-orange-600 dark:text-orange-400'>
                                                    {selectedRecord.lpd_vote}
                                                </p>
                                            </div>
                                        )}
                                        {Number(selectedRecord.gpd_vote) > 0 && (
                                            <div className='rounded-md border bg-yellow-50 p-3 dark:bg-yellow-900/20'>
                                                <p className='text-muted-foreground text-xs'>GPD</p>
                                                <p className='text-2xl font-bold text-yellow-600 dark:text-yellow-400'>
                                                    {selectedRecord.gpd_vote}
                                                </p>
                                            </div>
                                        )}
                                        {Number(selectedRecord.lrda_vote) > 0 && (
                                            <div className='rounded-md border bg-green-50 p-3 dark:bg-green-900/20'>
                                                <p className='text-muted-foreground text-xs'>LRDA</p>
                                                <p className='text-2xl font-bold text-green-600 dark:text-green-400'>
                                                    {selectedRecord.lrda_vote}
                                                </p>
                                            </div>
                                        )}
                                        {Number(selectedRecord.grda_vote) > 0 && (
                                            <div className='rounded-md border bg-amber-50 p-3 dark:bg-amber-900/20'>
                                                <p className='text-muted-foreground text-xs'>GRDA</p>
                                                <p className='text-2xl font-bold text-amber-600 dark:text-amber-400'>
                                                    {selectedRecord.grda_vote}
                                                </p>
                                            </div>
                                        )}
                                        {Number(selectedRecord.other_vote) > 0 && (
                                            <div className='rounded-md border bg-gray-50 p-3 dark:bg-gray-800/50'>
                                                <p className='text-muted-foreground text-xs'>Other</p>
                                                <p className='text-2xl font-bold'>{selectedRecord.other_vote}</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className='mt-6 rounded-md border p-4'>
                                        <h3 className='mb-2 font-medium'>Vote Analysis</h3>
                                        <p className='text-muted-foreground mb-4 text-sm'>
                                            This record has a consensus of{' '}
                                            <Badge variant={getConsensusColor(selectedRecord.expert_consensus)}>
                                                {selectedRecord.expert_consensus}
                                            </Badge>{' '}
                                            based on expert voting.
                                        </p>
                                    </div>
                                </TabsContent>
                                <TabsContent value='spectrogram' className='pt-4'>
                                    {/* Replace this part with the MultiChannelSpectrogram component */}
                                    <MultiChannelSpectrogram
                                        data={multiChannelData[selectedRecord.spectrogram_id] || null}
                                        title={`Spectrogram for EEG ${selectedRecord.eeg_id}`}
                                        patientId={selectedRecord.patient_id}
                                        recordId={selectedRecord.eeg_id}
                                        offsets={
                                            selectedRecord.offsets || [
                                                parseFloat(selectedRecord.eeg_label_offset_seconds)
                                            ]
                                        }
                                    />
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant='outline' onClick={() => setModalOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
