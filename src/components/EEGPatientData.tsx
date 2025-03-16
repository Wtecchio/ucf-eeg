"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination"
import { Progress } from "@/components/ui/progress"
import {
    AlertCircle,
    ArrowDownUp,
    BarChart3,
    Brain,
    Download,
    FileDown,
    Search,
    Settings,
    Users,
    AudioWaveformIcon as Waveform,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { type EEGData, type SpectrogramData, fetchCSVFromURL, generateSpectrogramData } from "./csv-parser"
import SpectrogramVisualization from "./spectrogram-visualization"

const CSV_URL = "/sample_data/sample_train.csv"


export default function EEGPatientData() {
    const [eegData, setEEGData] = useState<EEGData[]>([])
    const [spectrogramData, setSpectrogramData] = useState<Record<string, SpectrogramData>>({})
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)
    const [groupedByPatient, setGroupedByPatient] = useState<Record<string, EEGData[]>>({})
    const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
    const [selectedRecord, setSelectedRecord] = useState<EEGData | null>(null)
    const [modalOpen, setModalOpen] = useState<boolean>(false)
    const [searchQuery, setSearchQuery] = useState<string>("")
    const [sortColumn, setSortColumn] = useState<string | null>(null)
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
    const [currentPage, setCurrentPage] = useState<number>(1)
    const [recordsPerPage, setRecordsPerPage] = useState<number>(10)
    const [activeTab, setActiveTab] = useState<string>("records")
    const [patientFilter, setPatientFilter] = useState<string>("all")
    const [fileUploaded, setFileUploaded] = useState<boolean>(false)
    const [loadingSpectrogram, setLoadingSpectrogram] = useState<boolean>(false)

    // Function to handle CSV file upload
    const handleCSVFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setLoading(true)
        setError(null)

        try {
            // Read the file as text
            const text = await file.text()

            // Parse the CSV
            const records = await parseCSV(text)

            processEEGData(records)
            setFileUploaded(true)
        } catch (err) {
            console.error("Error parsing CSV file:", err)
            setError("Failed to parse CSV file. Please ensure it's a valid CSV format.")
            setLoading(false)
        }
    }

    // Parse CSV text
    const parseCSV = async (csvText: string): Promise<EEGData[]> => {
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
    }

    // Process EEG data after loading
    const processEEGData = (records: EEGData[]) => {
        setEEGData(records)

        // Group by patient_id
        const grouped = records.reduce<Record<string, EEGData[]>>((acc, curr) => {
            if (!curr.patient_id) return acc

            if (!acc[curr.patient_id]) {
                acc[curr.patient_id] = []
            }

            acc[curr.patient_id].push(curr)
            return acc
        }, {})

        setGroupedByPatient(grouped)

        // Generate mock spectrogram data for each record
        const mockSpectrogramData: Record<string, SpectrogramData> = {}

        records.forEach((record) => {
            const key = `${record.patient_id}_${record.eeg_id}`
            mockSpectrogramData[key] = generateSpectrogramData(record.patient_id, record.eeg_id)
        })

        setSpectrogramData(mockSpectrogramData)
        setLoading(false)
    }

    // Load data from the CSV URL
    useEffect(() => {
        const loadCSVData = async () => {
            try {
                setLoading(true)

                // Fetch and parse the CSV data
                const records = await fetchCSVFromURL(CSV_URL)

                processEEGData(records)
            } catch (error) {
                console.error("Error loading CSV data:", error)
                setError("Failed to load data from the CSV URL")
                setLoading(false)
            }
        }

        loadCSVData()
    }, [])

    // Filter patients based on search query
    const filteredPatients = useMemo(() => {
        if (!searchQuery.trim()) {
            return Object.keys(groupedByPatient)
        }

        return Object.keys(groupedByPatient).filter((patientId) =>
            patientId.toLowerCase().includes(searchQuery.toLowerCase()),
        )
    }, [groupedByPatient, searchQuery])

    // Get patient records with sorting and filtering
    const patientRecords = useMemo(() => {
        if (!selectedPatient) return []

        let records = [...groupedByPatient[selectedPatient]]

        // Filter by consensus if needed
        if (patientFilter !== "all") {
            records = records.filter((record) => record.expert_consensus.toLowerCase() === patientFilter.toLowerCase())
        }

        // Sort records if a sort column is selected
        if (sortColumn) {
            records.sort((a, b) => {
                const aValue = a[sortColumn as keyof EEGData] || ""
                const bValue = b[sortColumn as keyof EEGData] || ""

                if (sortDirection === "asc") {
                    return aValue.localeCompare(bValue)
                } else {
                    return bValue.localeCompare(aValue)
                }
            })
        }

        return records
    }, [selectedPatient, groupedByPatient, sortColumn, sortDirection, patientFilter])

    // Pagination
    const paginatedRecords = useMemo(() => {
        const startIndex = (currentPage - 1) * recordsPerPage
        return patientRecords.slice(startIndex, startIndex + recordsPerPage)
    }, [patientRecords, currentPage, recordsPerPage])

    const totalPages = useMemo(() => {
        return Math.ceil(patientRecords.length / recordsPerPage)
    }, [patientRecords, recordsPerPage])

    // Calculate patient statistics for dashboard
    const patientStats = useMemo((): {
        totalRecords: number
        consensusDistribution: Record<string, number>
        voteDistribution: Record<string, number>
    } | null => {
        if (!selectedPatient) return null

        const records = groupedByPatient[selectedPatient]
        const totalRecords = records.length

        // Calculate consensus distribution
        const consensusDistribution = records.reduce<Record<string, number>>((acc, record) => {
            const consensus = record.expert_consensus
            if (!acc[consensus]) acc[consensus] = 0
            acc[consensus]++
            return acc
        }, {})

        // Calculate vote distribution
        const voteDistribution = {
            seizure: records.reduce((sum, record) => sum + Number(record.seizure_vote), 0),
            lpd: records.reduce((sum, record) => sum + Number(record.lpd_vote), 0),
            gpd: records.reduce((sum, record) => sum + Number(record.gpd_vote), 0),
            lrda: records.reduce((sum, record) => sum + Number(record.lrda_vote), 0),
            grda: records.reduce((sum, record) => sum + Number(record.grda_vote), 0),
            other: records.reduce((sum, record) => sum + Number(record.other_vote), 0),
        }

        return {
            totalRecords,
            consensusDistribution,
            voteDistribution,
        }
    }, [selectedPatient, groupedByPatient])

    const handleRecordClick = (record: EEGData) => {
        setSelectedRecord(record)
        setModalOpen(true)
    }

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            // Toggle direction if same column
            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
        } else {
            // Set new column and default to ascending
            setSortColumn(column)
            setSortDirection("asc")
        }
    }

    const exportData = (format: "csv" | "json") => {
        if (!selectedPatient) return

        const records = groupedByPatient[selectedPatient]
        let content: string
        let filename: string

        if (format === "csv") {
            // Create CSV content
            const headers = Object.keys(records[0]).join(",")
            const rows = records
                .map((record) =>
                    Object.values(record)
                        .map((value) => `"${value}"`)
                        .join(","),
                )
                .join("\n")
            content = `${headers}\n${rows}`
            filename = `patient_${selectedPatient}_data.csv`
        } else {
            // Create JSON content
            content = JSON.stringify(records, null, 2)
            filename = `patient_${selectedPatient}_data.json`
        }

        // Create download link
        const blob = new Blob([content], { type: format === "csv" ? "text/csv" : "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const getConsensusColor = (consensus: string): "destructive" | "secondary" | "default" | "outline" => {
        switch (consensus) {
            case "Seizure":
                return "destructive"
            case "GRDA":
                return "secondary"
            case "LPD":
                return "default"
            case "GPD":
                return "outline"
            case "LRDA":
                return "secondary"
            default:
                return "default"
        }
    }

    // Get spectrogram data for a specific record
    const getSpectrogramData = (patientId: string, eegId: string): SpectrogramData | null => {
        const key = `${patientId}_${eegId}`
        return spectrogramData[key] || null
    }

    if (loading) {
        return (
            <div className="container mx-auto p-6 h-screen flex items-center justify-center">
                <Card className="w-full max-w-6xl">
                    <CardHeader>
                        <CardTitle>EEG Patient Data</CardTitle>
                        <CardDescription>Loading patient information...</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="w-full md:w-1/4 space-y-2">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <Skeleton key={i} className="h-10 w-full" />
                                ))}
                            </div>
                            <div className="w-full md:w-3/4">
                                <Skeleton className="h-8 w-full mb-4" />
                                <Skeleton className="h-64 w-full" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (error) {
        return (
            <div className="container mx-auto p-6 h-screen flex items-center justify-center">
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6">
            <Card className="w-full">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Brain className="h-6 w-6" /> EEG Patient Data
                        </CardTitle>
                        <CardDescription>View and analyze electroencephalogram data by patient</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon">
                                    <Settings className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setRecordsPerPage(5)}>Show 5 records per page</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setRecordsPerPage(10)}>Show 10 records per page</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setRecordsPerPage(20)}>Show 20 records per page</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                    <label htmlFor="new-csv-file-upload" className="cursor-pointer w-full">
                                        Upload New CSV File
                                    </label>
                                    <input
                                        id="new-csv-file-upload"
                                        type="file"
                                        accept=".csv"
                                        className="hidden"
                                        onChange={handleCSVFileUpload}
                                    />
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Patient List */}
                        <Card className="w-full md:w-1/4">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Users className="h-4 w-4" /> Patients
                                </CardTitle>
                                <div className="relative mt-2">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search patients..."
                                        className="pl-8"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="h-[calc(100vh-350px)]">
                                    <div className="p-4 space-y-2">
                                        {filteredPatients.length === 0 ? (
                                            <p className="text-center text-muted-foreground py-4">No patients found</p>
                                        ) : (
                                            filteredPatients.map((patientId) => (
                                                <button
                                                    key={patientId}
                                                    onClick={() => {
                                                        setSelectedPatient(patientId)
                                                        setCurrentPage(1) // Reset to first page when changing patient
                                                        setActiveTab("records") // Reset to records tab
                                                    }}
                                                    className={`w-full text-left p-3 rounded-md transition-colors flex justify-between items-center ${
                                                        selectedPatient === patientId ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                                    }`}
                                                >
                                                    <span>Patient {patientId}</span>
                                                    <Badge variant="outline">{groupedByPatient[patientId].length}</Badge>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                            <CardFooter className="pt-3 pb-4 flex justify-center">
                                <Badge variant="outline" className="px-3">
                                    {Object.keys(groupedByPatient).length} Patients Total
                                </Badge>
                            </CardFooter>
                        </Card>

                        {/* Patient Data */}
                        <Card className="w-full md:w-3/4">
                            <CardContent className="p-6">
                                {!selectedPatient ? (
                                    <div className="flex flex-col items-center justify-center h-[calc(100vh-300px)] gap-4">
                                        <Brain className="h-16 w-16 text-muted-foreground/50" />
                                        <p className="text-muted-foreground text-center">
                                            Select a patient from the list to view their EEG data
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                            <div>
                                                <h2 className="text-2xl font-bold flex items-center gap-2">Patient {selectedPatient}</h2>
                                                <p className="text-muted-foreground">
                                                    {patientRecords.length} Records {patientFilter !== "all" && `(filtered)`}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <Select value={patientFilter} onValueChange={setPatientFilter}>
                                                    <SelectTrigger className="w-[180px]">
                                                        <SelectValue placeholder="Filter by consensus" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All Consensus Types</SelectItem>
                                                        <SelectItem value="seizure">Seizure</SelectItem>
                                                        <SelectItem value="lpd">LPD</SelectItem>
                                                        <SelectItem value="gpd">GPD</SelectItem>
                                                        <SelectItem value="lrda">LRDA</SelectItem>
                                                        <SelectItem value="grda">GRDA</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" className="gap-1">
                                                            <FileDown className="h-4 w-4" /> Export
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => exportData("csv")}>
                                                            <Download className="h-4 w-4 mr-2" /> Export as CSV
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => exportData("json")}>
                                                            <Download className="h-4 w-4 mr-2" /> Export as JSON
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>

                                        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
                                            <TabsList>
                                                <TabsTrigger value="records">Records</TabsTrigger>
                                                <TabsTrigger value="spectrograms">Spectrograms</TabsTrigger>
                                                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                                            </TabsList>

                                            {/* Records Tab */}
                                            <TabsContent value="records" className="mt-4">
                                                <ScrollArea className="h-[calc(100vh-450px)]">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead
                                                                    className="cursor-pointer hover:text-primary"
                                                                    onClick={() => handleSort("eeg_id")}
                                                                >
                                                                    <div className="flex items-center gap-1">
                                                                        EEG ID
                                                                        {sortColumn === "eeg_id" && <ArrowDownUp className="h-3 w-3" />}
                                                                    </div>
                                                                </TableHead>
                                                                <TableHead
                                                                    className="cursor-pointer hover:text-primary"
                                                                    onClick={() => handleSort("spectrogram_id")}
                                                                >
                                                                    <div className="flex items-center gap-1">
                                                                        Spectrogram ID
                                                                        {sortColumn === "spectrogram_id" && <ArrowDownUp className="h-3 w-3" />}
                                                                    </div>
                                                                </TableHead>
                                                                <TableHead
                                                                    className="cursor-pointer hover:text-primary"
                                                                    onClick={() => handleSort("eeg_label_offset_seconds")}
                                                                >
                                                                    <div className="flex items-center gap-1">
                                                                        Offset (sec)
                                                                        {sortColumn === "eeg_label_offset_seconds" && <ArrowDownUp className="h-3 w-3" />}
                                                                    </div>
                                                                </TableHead>
                                                                <TableHead
                                                                    className="cursor-pointer hover:text-primary"
                                                                    onClick={() => handleSort("expert_consensus")}
                                                                >
                                                                    <div className="flex items-center gap-1">
                                                                        Expert Consensus
                                                                        {sortColumn === "expert_consensus" && <ArrowDownUp className="h-3 w-3" />}
                                                                    </div>
                                                                </TableHead>
                                                                <TableHead>Votes</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {paginatedRecords.length === 0 ? (
                                                                <TableRow>
                                                                    <TableCell colSpan={5} className="text-center py-8">
                                                                        No records found
                                                                        {patientFilter !== "all" && (
                                                                            <div className="mt-2">
                                                                                <Button variant="link" onClick={() => setPatientFilter("all")}>
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
                                                                        className="cursor-pointer hover:bg-muted/50"
                                                                        onClick={() => handleRecordClick(record)}
                                                                    >
                                                                        <TableCell>{record.eeg_id}</TableCell>
                                                                        <TableCell>{record.spectrogram_id}</TableCell>
                                                                        <TableCell>{record.eeg_label_offset_seconds}</TableCell>
                                                                        <TableCell>
                                                                            <Badge variant={getConsensusColor(record.expert_consensus)}>
                                                                                {record.expert_consensus}
                                                                            </Badge>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {Number(record.seizure_vote) > 0 && (
                                                                                    <Badge
                                                                                        variant="default"
                                                                                        className="text-xs bg-red-500 text-white hover:bg-red-600"
                                                                                    >
                                                                                        Seizure: {record.seizure_vote}
                                                                                    </Badge>
                                                                                )}
                                                                                {Number(record.lpd_vote) > 0 && (
                                                                                    <Badge
                                                                                        variant="default"
                                                                                        className="text-xs bg-orange-500 text-white hover:bg-orange-600"
                                                                                    >
                                                                                        LPD: {record.lpd_vote}
                                                                                    </Badge>
                                                                                )}
                                                                                {Number(record.gpd_vote) > 0 && (
                                                                                    <Badge
                                                                                        variant="default"
                                                                                        className="text-xs bg-yellow-500 text-black hover:bg-yellow-600"
                                                                                    >
                                                                                        GPD: {record.gpd_vote}
                                                                                    </Badge>
                                                                                )}
                                                                                {Number(record.lrda_vote) > 0 && (
                                                                                    <Badge
                                                                                        variant="default"
                                                                                        className="text-xs bg-green-500 text-white hover:bg-green-600"
                                                                                    >
                                                                                        LRDA: {record.lrda_vote}
                                                                                    </Badge>
                                                                                )}
                                                                                {Number(record.grda_vote) > 0 && (
                                                                                    <Badge
                                                                                        variant="default"
                                                                                        className="text-xs bg-amber-500 text-black hover:bg-amber-600"
                                                                                    >
                                                                                        GRDA: {record.grda_vote}
                                                                                    </Badge>
                                                                                )}
                                                                                {Number(record.other_vote) > 0 && (
                                                                                    <Badge variant="secondary" className="text-xs">
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

                                                {/* Pagination */}
                                                {paginatedRecords.length > 0 && (
                                                    <div className="mt-4 flex items-center justify-between">
                                                        <div className="text-sm text-muted-foreground">
                                                            Showing {(currentPage - 1) * recordsPerPage + 1} to{" "}
                                                            {Math.min(currentPage * recordsPerPage, patientRecords.length)} of {patientRecords.length}{" "}
                                                            records
                                                        </div>
                                                        <Pagination>
                                                            <PaginationContent>
                                                                <PaginationItem>
                                                                    <PaginationPrevious
                                                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                                                        className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                                                                    />
                                                                </PaginationItem>

                                                                {/* First page */}
                                                                {currentPage > 3 && (
                                                                    <PaginationItem>
                                                                        <PaginationLink onClick={() => setCurrentPage(1)}>1</PaginationLink>
                                                                    </PaginationItem>
                                                                )}

                                                                {/* Ellipsis if needed */}
                                                                {currentPage > 4 && (
                                                                    <PaginationItem>
                                                                        <PaginationEllipsis />
                                                                    </PaginationItem>
                                                                )}

                                                                {/* Pages around current */}
                                                                {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                                                                    const pageNum = Math.min(Math.max(currentPage - 1, 1) + i, totalPages)
                                                                    // Skip if we're showing first/last pages separately
                                                                    if (
                                                                        (currentPage > 3 && pageNum === 1) ||
                                                                        (currentPage < totalPages - 2 && pageNum === totalPages)
                                                                    ) {
                                                                        return null
                                                                    }
                                                                    return (
                                                                        <PaginationItem key={pageNum}>
                                                                            <PaginationLink
                                                                                onClick={() => setCurrentPage(pageNum)}
                                                                                isActive={currentPage === pageNum}
                                                                            >
                                                                                {pageNum}
                                                                            </PaginationLink>
                                                                        </PaginationItem>
                                                                    )
                                                                })}

                                                                {/* Ellipsis if needed */}
                                                                {currentPage < totalPages - 3 && (
                                                                    <PaginationItem>
                                                                        <PaginationEllipsis />
                                                                    </PaginationItem>
                                                                )}

                                                                {/* Last page */}
                                                                {totalPages > 3 && currentPage < totalPages - 2 && (
                                                                    <PaginationItem>
                                                                        <PaginationLink onClick={() => setCurrentPage(totalPages)}>
                                                                            {totalPages}
                                                                        </PaginationLink>
                                                                    </PaginationItem>
                                                                )}

                                                                <PaginationItem>
                                                                    <PaginationNext
                                                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                                                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                                                                    />
                                                                </PaginationItem>
                                                            </PaginationContent>
                                                        </Pagination>
                                                    </div>
                                                )}
                                            </TabsContent>

                                            {/* Spectrograms Tab */}
                                            <TabsContent value="spectrograms" className="mt-4">
                                                {patientRecords.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center h-[300px] gap-4">
                                                        <Waveform className="h-16 w-16 text-muted-foreground/50" />
                                                        <p className="text-muted-foreground text-center">No records found for this patient</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-6">
                                                        {paginatedRecords.map((record, idx) => {
                                                            const spectrogramData = getSpectrogramData(record.patient_id, record.eeg_id)
                                                            return (
                                                                <div key={idx} className="border rounded-lg p-4">
                                                                    <div className="flex justify-between items-center mb-4">
                                                                        <h3 className="text-lg font-medium">Record: {record.eeg_id}</h3>
                                                                        <Badge variant={getConsensusColor(record.expert_consensus)}>
                                                                            {record.expert_consensus}
                                                                        </Badge>
                                                                    </div>

                                                                    <SpectrogramVisualization
                                                                        data={spectrogramData}
                                                                        title={`Spectrogram for EEG ${record.eeg_id}`}
                                                                        patientId={record.patient_id}
                                                                        recordId={record.eeg_id}
                                                                    />
                                                                </div>
                                                            )
                                                        })}

                                                        {/* Pagination for spectrograms */}
                                                        {paginatedRecords.length > 0 && (
                                                            <div className="mt-4 flex items-center justify-between">
                                                                <div className="text-sm text-muted-foreground">
                                                                    Showing {(currentPage - 1) * recordsPerPage + 1} to{" "}
                                                                    {Math.min(currentPage * recordsPerPage, patientRecords.length)} of{" "}
                                                                    {patientRecords.length} records
                                                                </div>
                                                                <Pagination>
                                                                    <PaginationContent>
                                                                        <PaginationItem>
                                                                            <PaginationPrevious
                                                                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                                                                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                                                                            />
                                                                        </PaginationItem>

                                                                        {/* First page */}
                                                                        {currentPage > 3 && (
                                                                            <PaginationItem>
                                                                                <PaginationLink onClick={() => setCurrentPage(1)}>1</PaginationLink>
                                                                            </PaginationItem>
                                                                        )}

                                                                        {/* Ellipsis if needed */}
                                                                        {currentPage > 4 && (
                                                                            <PaginationItem>
                                                                                <PaginationEllipsis />
                                                                            </PaginationItem>
                                                                        )}

                                                                        {/* Pages around current */}
                                                                        {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                                                                            const pageNum = Math.min(Math.max(currentPage - 1, 1) + i, totalPages)
                                                                            // Skip if we're showing first/last pages separately
                                                                            if (
                                                                                (currentPage > 3 && pageNum === 1) ||
                                                                                (currentPage < totalPages - 2 && pageNum === totalPages)
                                                                            ) {
                                                                                return null
                                                                            }
                                                                            return (
                                                                                <PaginationItem key={pageNum}>
                                                                                    <PaginationLink
                                                                                        onClick={() => setCurrentPage(pageNum)}
                                                                                        isActive={currentPage === pageNum}
                                                                                    >
                                                                                        {pageNum}
                                                                                    </PaginationLink>
                                                                                </PaginationItem>
                                                                            )
                                                                        })}

                                                                        {/* Ellipsis if needed */}
                                                                        {currentPage < totalPages - 3 && (
                                                                            <PaginationItem>
                                                                                <PaginationEllipsis />
                                                                            </PaginationItem>
                                                                        )}

                                                                        {/* Last page */}
                                                                        {totalPages > 3 && currentPage < totalPages - 2 && (
                                                                            <PaginationItem>
                                                                                <PaginationLink onClick={() => setCurrentPage(totalPages)}>
                                                                                    {totalPages}
                                                                                </PaginationLink>
                                                                            </PaginationItem>
                                                                        )}

                                                                        <PaginationItem>
                                                                            <PaginationNext
                                                                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                                                                className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
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
                                            <TabsContent value="dashboard" className="mt-4">
                                                {patientStats && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        {/* Summary Card */}
                                                        <Card>
                                                            <CardHeader>
                                                                <CardTitle className="text-lg">Patient Summary</CardTitle>
                                                            </CardHeader>
                                                            <CardContent>
                                                                <div className="space-y-4">
                                                                    <div>
                                                                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Records</h3>
                                                                        <div className="text-3xl font-bold">{patientStats.totalRecords}</div>
                                                                    </div>

                                                                    <div>
                                                                        <h3 className="text-sm font-medium text-muted-foreground mb-1">
                                                                            Consensus Distribution
                                                                        </h3>
                                                                        <div className="space-y-2">
                                                                            {Object.entries(patientStats.consensusDistribution).map(([type, count]) => (
                                                                                <div key={type} className="space-y-1">
                                                                                    <div className="flex justify-between text-sm">
                                                                                        <span>{type}</span>
                                                                                        <span className="font-medium">
                                              {count} ({Math.round((count / patientStats.totalRecords) * 100)}%)
                                            </span>
                                                                                    </div>
                                                                                    <Progress value={(count / patientStats.totalRecords) * 100} className="h-2" />
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
                                                                <CardTitle className="text-lg">Vote Distribution</CardTitle>
                                                            </CardHeader>
                                                            <CardContent>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    {Object.entries(patientStats.voteDistribution).map(([type, count]) => (
                                                                        <div key={type} className="border rounded-md p-3">
                                                                            <div className="text-sm text-muted-foreground capitalize">{type}</div>
                                                                            <div className="text-2xl font-bold mt-1">{count}</div>
                                                                            <div className="mt-2">
                                                                                <Progress
                                                                                    value={count}
                                                                                    max={Object.values(patientStats.voteDistribution).reduce((a, b) => a + b, 0)}
                                                                                    className="h-1.5"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </CardContent>
                                                        </Card>

                                                        {/* Spectrogram Overview */}
                                                        <Card className="md:col-span-2">
                                                            <CardHeader>
                                                                <CardTitle className="text-lg flex items-center gap-2">
                                                                    <BarChart3 className="h-4 w-4" /> Spectrogram Analysis
                                                                </CardTitle>
                                                            </CardHeader>
                                                            <CardContent>
                                                                {patientRecords.length > 0 && (
                                                                    <SpectrogramVisualization
                                                                        data={getSpectrogramData(selectedPatient, patientRecords[0].eeg_id)}
                                                                        title="Representative Spectrogram"
                                                                        patientId={selectedPatient}
                                                                        recordId={patientRecords[0].eeg_id}
                                                                    />
                                                                )}
                                                            </CardContent>
                                                        </Card>
                                                    </div>
                                                )}
                                            </TabsContent>
                                        </Tabs>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>

            {/* Modal Dialog */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-[800px]">
                    <DialogHeader>
                        <DialogTitle>EEG Record Details</DialogTitle>
                        <DialogDescription>Detailed information about the selected EEG recording</DialogDescription>
                    </DialogHeader>
                    {selectedRecord && (
                        <div className="grid gap-4">
                            <Tabs defaultValue="details">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="details">Details</TabsTrigger>
                                    <TabsTrigger value="votes">Votes Analysis</TabsTrigger>
                                    <TabsTrigger value="spectrogram">Spectrogram</TabsTrigger>
                                </TabsList>
                                <TabsContent value="details" className="space-y-4 pt-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <h3 className="font-medium text-sm text-muted-foreground">Patient ID</h3>
                                            <p className="font-semibold">{selectedRecord.patient_id}</p>
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-sm text-muted-foreground">Expert Consensus</h3>
                                            <Badge variant={getConsensusColor(selectedRecord.expert_consensus)} className="mt-1">
                                                {selectedRecord.expert_consensus}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <h3 className="font-medium text-sm text-muted-foreground">EEG ID</h3>
                                            <p>{selectedRecord.eeg_id}</p>
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-sm text-muted-foreground">EEG Sub ID</h3>
                                            <p>{selectedRecord.eeg_sub_id}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <h3 className="font-medium text-sm text-muted-foreground">Spectrogram ID</h3>
                                            <p>{selectedRecord.spectrogram_id}</p>
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-sm text-muted-foreground">Spectrogram Sub ID</h3>
                                            <p>{selectedRecord.spectrogram_sub_id}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <h3 className="font-medium text-sm text-muted-foreground">EEG Offset (sec)</h3>
                                            <p>{selectedRecord.eeg_label_offset_seconds}</p>
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-sm text-muted-foreground">Spectrogram Offset (sec)</h3>
                                            <p>{selectedRecord.spectrogram_label_offset_seconds}</p>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="votes" className="pt-4">
                                    <h3 className="font-medium text-sm text-muted-foreground mb-3">Vote Distribution</h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        {Number(selectedRecord.seizure_vote) > 0 && (
                                            <div className="border rounded-md p-3 bg-red-50 dark:bg-red-900/20">
                                                <p className="text-xs text-muted-foreground">Seizure</p>
                                                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                                                    {selectedRecord.seizure_vote}
                                                </p>
                                            </div>
                                        )}
                                        {Number(selectedRecord.lpd_vote) > 0 && (
                                            <div className="border rounded-md p-3 bg-orange-50 dark:bg-orange-900/20">
                                                <p className="text-xs text-muted-foreground">LPD</p>
                                                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                                    {selectedRecord.lpd_vote}
                                                </p>
                                            </div>
                                        )}
                                        {Number(selectedRecord.gpd_vote) > 0 && (
                                            <div className="border rounded-md p-3 bg-yellow-50 dark:bg-yellow-900/20">
                                                <p className="text-xs text-muted-foreground">GPD</p>
                                                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                                                    {selectedRecord.gpd_vote}
                                                </p>
                                            </div>
                                        )}
                                        {Number(selectedRecord.lrda_vote) > 0 && (
                                            <div className="border rounded-md p-3 bg-green-50 dark:bg-green-900/20">
                                                <p className="text-xs text-muted-foreground">LRDA</p>
                                                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                                    {selectedRecord.lrda_vote}
                                                </p>
                                            </div>
                                        )}
                                        {Number(selectedRecord.grda_vote) > 0 && (
                                            <div className="border rounded-md p-3 bg-amber-50 dark:bg-amber-900/20">
                                                <p className="text-xs text-muted-foreground">GRDA</p>
                                                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                                    {selectedRecord.grda_vote}
                                                </p>
                                            </div>
                                        )}
                                        {Number(selectedRecord.other_vote) > 0 && (
                                            <div className="border rounded-md p-3 bg-gray-50 dark:bg-gray-800/50">
                                                <p className="text-xs text-muted-foreground">Other</p>
                                                <p className="text-2xl font-bold">{selectedRecord.other_vote}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-6 border rounded-md p-4">
                                        <h3 className="font-medium mb-2">Vote Analysis</h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            This record has a consensus of{" "}
                                            <Badge variant={getConsensusColor(selectedRecord.expert_consensus)}>
                                                {selectedRecord.expert_consensus}
                                            </Badge>
                                            based on expert voting.
                                        </p>
                                    </div>
                                </TabsContent>

                                <TabsContent value="spectrogram" className="pt-4">
                                    <SpectrogramVisualization
                                        data={getSpectrogramData(selectedRecord.patient_id, selectedRecord.eeg_id)}
                                        title={`Spectrogram for EEG ${selectedRecord.eeg_id}`}
                                        patientId={selectedRecord.patient_id}
                                        recordId={selectedRecord.eeg_id}
                                    />
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

