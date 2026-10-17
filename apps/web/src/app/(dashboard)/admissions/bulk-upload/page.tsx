'use client';

import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  FileUp,
  RefreshCw,
  Users,
  UserPlus,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { admissionsApi, academicApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ValidationError {
  row: number;
  field?: string;
  message: string;
}

interface UploadResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: ValidationError[];
  createdApplications: string[];
}

type UploadStep = 'upload' | 'validate' | 'process' | 'complete';

export default function AdmissionsBulkUploadPage() {
  const router = useRouter();
  const [uploadType, setUploadType] = useState<'applications' | 'leads'>('applications');
  const [step, setStep] = useState<UploadStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validatedData, setValidatedData] = useState<Array<Record<string, string>>>([]);
  const [validCount, setValidCount] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [academicBatches, setAcademicBatches] = useState<
    Array<{ _id: string; name: string; isCurrent: boolean }>
  >([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const res = await academicApi.getAcademicBatches();
        setAcademicBatches(res.data || []);
        const current = res.data?.find((b: { isCurrent: boolean }) => b.isCurrent);
        if (current) setSelectedBatchId(current._id);
      } catch (err) {
        console.error('Failed to fetch academic batches:', err);
      }
    };
    fetchBatches();
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
      setStep('validate');
    } else {
      toast.error('Please upload a CSV file');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Please upload a CSV file');
        return;
      }
      setFile(selectedFile);
      setStep('validate');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res =
        uploadType === 'applications'
          ? await admissionsApi.getApplicationsTemplate()
          : await admissionsApi.getLeadsTemplate();

      const headers = res.data || [];
      const csvContent = headers.join(',');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${uploadType}_template.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch (err) {
      console.error('Failed to download template:', err);
      toast.error('Failed to download template');
    }
  };

  const parseCSV = (text: string): Array<Record<string, string>> => {
    const lines = text.split('\n').filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
    const data: Array<Record<string, string>> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/"/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }

    return data;
  };

  const handleValidate = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const text = await file.text();
      const data = parseCSV(text);

      if (data.length === 0) {
        toast.error('No data found in CSV file');
        setIsProcessing(false);
        return;
      }

      setValidatedData(data);
      setValidCount(data.length);
      setStep('process');
      toast.success(`${data.length} rows ready for processing`);
    } catch (err) {
      console.error('Failed to validate file:', err);
      toast.error('Failed to parse CSV file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcess = async () => {
    if (validatedData.length === 0) return;

    if (uploadType === 'applications' && !selectedBatchId) {
      toast.error('Please select an academic batch');
      return;
    }

    setIsProcessing(true);
    try {
      const res =
        uploadType === 'applications'
          ? await admissionsApi.bulkUploadApplications(selectedBatchId, validatedData)
          : await admissionsApi.bulkUploadLeads(validatedData);

      setResult(res.data);
      setStep('complete');

      if (res.data.errorCount === 0) {
        toast.success(`Successfully created ${res.data.successCount} ${uploadType}`);
      } else {
        toast.warning(`Created ${res.data.successCount}, failed ${res.data.errorCount}`);
      }
    } catch (err) {
      console.error('Failed to process upload:', err);
      toast.error('Failed to process upload');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetUpload = () => {
    setStep('upload');
    setFile(null);
    setValidatedData([]);
    setValidCount(0);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk Upload"
        description="Upload multiple applications or leads at once"
        actions={[
          {
            label: 'Download Template',
            icon: Download,
            variant: 'outline',
            onClick: handleDownloadTemplate,
          },
        ]}
      />

      {/* Upload Type Selection */}
      <Tabs
        value={uploadType}
        onValueChange={(v) => {
          setUploadType(v as 'applications' | 'leads');
          resetUpload();
        }}
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="applications" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Applications
          </TabsTrigger>
          <TabsTrigger value="leads" className="gap-2">
            <Users className="h-4 w-4" />
            Leads
          </TabsTrigger>
        </TabsList>

        <TabsContent value={uploadType} className="mt-6">
          {/* Step Progress */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {['upload', 'validate', 'process', 'complete'].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === s
                      ? 'bg-primary text-primary-foreground'
                      : ['complete'].includes(step) &&
                          i < ['upload', 'validate', 'process', 'complete'].indexOf(step)
                        ? 'bg-success text-success-foreground'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`text-sm capitalize ${step === s ? 'font-medium' : 'text-muted-foreground'}`}
                >
                  {s}
                </span>
                {i < 3 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-2" />}
              </div>
            ))}
          </div>

          {/* Upload Step */}
          {step === 'upload' && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Upload {uploadType === 'applications' ? 'Applications' : 'Leads'} CSV
                </CardTitle>
                <CardDescription>
                  Download the template, fill in the data, and upload the CSV file
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {uploadType === 'applications' && (
                  <div className="space-y-2">
                    <Label>Academic Batch</Label>
                    <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                      <SelectTrigger className="w-full max-w-xs">
                        <SelectValue placeholder="Select academic batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {academicBatches.map((batch) => (
                          <SelectItem key={batch._id} value={batch._id}>
                            {batch.name} {batch.isCurrent && '(Current)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                    isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Drag and drop your CSV file here</p>
                  <p className="text-muted-foreground mb-4">or click to browse</p>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    id="file-upload"
                    onChange={handleFileSelect}
                  />
                  <Button variant="outline" asChild>
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <FileUp className="mr-2 h-4 w-4" />
                      Browse Files
                    </label>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Validate Step */}
          {step === 'validate' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  File Selected
                </CardTitle>
                <CardDescription>{file?.name} - Click validate to check the data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">{file?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {file?.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}
                    </p>
                  </div>
                  <Button variant="outline" onClick={resetUpload}>
                    Change File
                  </Button>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button onClick={handleValidate} disabled={isProcessing}>
                    {isProcessing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-2 h-4 w-4" />
                    )}
                    Validate & Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Process Step */}
          {step === 'process' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-success" />
                  Ready to Process
                </CardTitle>
                <CardDescription>{validCount} rows validated and ready for import</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-success font-medium">
                    {validCount} {uploadType} ready to be created
                  </p>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={resetUpload}>
                    Start Over
                  </Button>
                  <Button onClick={handleProcess} disabled={isProcessing}>
                    {isProcessing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Process Upload
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Complete Step */}
          {step === 'complete' && result && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {result.errorCount === 0 ? (
                    <CheckCircle className="h-5 w-5 text-success" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  )}
                  Upload Complete
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-muted text-center">
                    <p className="text-2xl font-bold">{result.totalRows}</p>
                    <p className="text-sm text-muted-foreground">Total Rows</p>
                  </div>
                  <div className="p-4 rounded-lg bg-success/10 text-center">
                    <p className="text-2xl font-bold text-success">{result.successCount}</p>
                    <p className="text-sm text-muted-foreground">Successful</p>
                  </div>
                  <div className="p-4 rounded-lg bg-destructive/10 text-center">
                    <p className="text-2xl font-bold text-destructive">{result.errorCount}</p>
                    <p className="text-sm text-muted-foreground">Failed</p>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-medium text-destructive">Errors:</p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {result.errors.map((error, i) => (
                        <div key={i} className="p-2 rounded bg-destructive/10 text-sm">
                          <span className="font-medium">Row {error.row}:</span>{' '}
                          {error.field && (
                            <span className="text-muted-foreground">[{error.field}]</span>
                          )}{' '}
                          {error.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={resetUpload}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Upload More
                  </Button>
                  <Button
                    onClick={() =>
                      router.push(
                        `/admissions/${uploadType === 'applications' ? 'applications' : 'leads'}`
                      )
                    }
                  >
                    View {uploadType === 'applications' ? 'Applications' : 'Leads'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
