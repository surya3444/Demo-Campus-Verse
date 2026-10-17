'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  FileUp,
  RefreshCw,
  Eye,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { hrApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ProcessResult {
  row: number;
  employeeId?: string;
  status: 'success' | 'failed';
  message?: string;
}

interface UploadResult {
  total: number;
  success: number;
  failed: number;
  errors: ValidationError[];
  results: ProcessResult[];
}

type UploadStep = 'upload' | 'validate' | 'process' | 'complete';

export default function StaffBulkUploadPage() {
  const router = useRouter();
  const [step, setStep] = useState<UploadStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validatedData, setValidatedData] = useState<Array<Record<string, string>>>([]);
  const [validCount, setValidCount] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);

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
    setIsDownloading(true);
    try {
      const blob = await hrApi.getBulkUploadTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'staff_bulk_upload_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch {
      toast.error('Failed to download template');
    } finally {
      setIsDownloading(false);
    }
  };

  const parseCSV = (content: string): Array<Record<string, string>> => {
    const lines = content.split('\n').filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map((h) => h.trim().replace(/[*()]/g, '').split(' ')[0]);

    const headerMap: Record<string, string> = {
      firstname: 'firstName',
      lastname: 'lastName',
      dateofbirth: 'dateOfBirth',
      gender: 'gender',
      email: 'email',
      phone: 'phone',
      joiningdate: 'joiningDate',
      employmenttype: 'employmentType',
      department: 'department',
      designation: 'designation',
      isteaching: 'isTeaching',
      aadhar: 'aadhar',
      pan: 'pan',
      address: 'address',
      city: 'city',
      state: 'state',
      pincode: 'pincode',
    };

    const rows: Array<Record<string, string>> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        const normalizedHeader = headerMap[header.toLowerCase()] || header;
        row[normalizedHeader] = values[index]?.trim() || '';
      });

      if (row.firstName || row.lastName) {
        rows.push(row);
      }
    }

    return rows;
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.replace(/^"|"$/g, '').trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.replace(/^"|"$/g, '').trim());
    return result;
  };

  const handleValidate = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const content = await file.text();
      const parsedData = parseCSV(content);

      if (parsedData.length === 0) {
        toast.error('No valid data found in the file');
        setIsProcessing(false);
        return;
      }

      const response = await hrApi.validateBulkUpload(parsedData);

      if (response.success) {
        setValidationErrors(response.data.errors || []);
        setValidatedData(response.data.validatedData || parsedData);
        setValidCount(response.data.validCount || parsedData.length);
        setStep('process');
      } else {
        toast.error(response.error?.message || 'Validation failed');
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast.error('Failed to validate data');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcess = async () => {
    if (validatedData.length === 0) return;

    setIsProcessing(true);
    try {
      const response = await hrApi.processBulkUpload(validatedData);

      if (response.success) {
        setResult({
          total: response.data.totalRows || validatedData.length,
          success: response.data.successCount || 0,
          failed: response.data.failedCount || 0,
          errors: validationErrors,
          results: response.data.results || [],
        });
        setStep('complete');
        toast.success(`Successfully uploaded ${response.data.successCount} staff members!`);
      } else {
        toast.error(response.error?.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Process error:', error);
      toast.error('Failed to process upload');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setValidationErrors([]);
    setValidatedData([]);
    setValidCount(0);
    setResult(null);
  };

  const steps = [
    { id: 'upload', label: 'Upload File' },
    { id: 'validate', label: 'Validate' },
    { id: 'process', label: 'Process' },
    { id: 'complete', label: 'Complete' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/hr/staff')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader
          title="Bulk Upload Staff"
          description="Upload multiple staff members at once using a CSV file"
        />
      </div>

      {/* Progress Steps */}
      <Card className="border-0 shadow-elegant-sm">
        <CardContent className="py-6">
          <div className="flex items-start justify-between relative">
            <div className="absolute top-5 left-0 right-0 flex items-center justify-between px-[52px]">
              {steps.slice(0, -1).map((_, index) => (
                <div
                  key={index}
                  className={`flex-1 h-0.5 transition-colors ${
                    index < currentStepIndex ? 'bg-success' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            {steps.map((s, index) => (
              <div key={s.id} className="flex flex-col items-center z-10">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    index < currentStepIndex
                      ? 'bg-success text-white'
                      : index === currentStepIndex
                        ? 'bg-primary text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {index < currentStepIndex ? <CheckCircle className="h-5 w-5" /> : index + 1}
                </div>
                <p
                  className={`text-sm mt-2 ${
                    index <= currentStepIndex
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground'
                  }`}
                >
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      {step === 'upload' && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Upload File</CardTitle>
              <CardDescription>Upload your CSV file with staff data</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/20 hover:border-primary/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileUp className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Drag and drop your file here</p>
                    <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    id="file-upload"
                    onChange={handleFileSelect}
                  />
                  <Button asChild variant="outline">
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      Select File
                    </label>
                  </Button>
                  <p className="text-xs text-muted-foreground">Supported format: CSV</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Download Template</CardTitle>
              <CardDescription>Use our template with the correct column headers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-success" />
                  <div>
                    <p className="font-medium">Staff Upload Template</p>
                    <p className="text-sm text-muted-foreground">CSV with all required columns</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleDownloadTemplate}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download Template
                </Button>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-sm">Required Fields:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>* First Name</li>
                  <li>* Last Name</li>
                  <li>* Gender (male/female/other)</li>
                  <li>* Email</li>
                  <li>* Phone (10 digits)</li>
                  <li>* Joining Date (YYYY-MM-DD)</li>
                  <li>* Employment Type (permanent/contract/probation/intern)</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-sm">Optional Fields:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>Date of Birth, Department, Designation</li>
                  <li>Is Teaching (yes/no)</li>
                  <li>Aadhar, PAN</li>
                  <li>Address, City, State, Pincode</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'validate' && (
        <Card>
          <CardHeader>
            <CardTitle>Validating Data</CardTitle>
            <CardDescription>Checking your file for errors and missing data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {file && (
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <FileSpreadsheet className="h-10 w-10 text-primary" />
                <div className="flex-1">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Badge className="bg-success/10 text-success">Ready</Badge>
              </div>
            )}

            <div className="flex justify-center py-8">
              {!isProcessing ? (
                <Button onClick={handleValidate} size="lg" className="gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Validate Data
                </Button>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <RefreshCw className="h-10 w-10 text-primary animate-spin" />
                  <p className="text-muted-foreground">Validating your data...</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'process' && (
        <div className="space-y-6">
          {validationErrors.length > 0 && (
            <Card className="border-warning/30">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <CardTitle className="text-warning">Validation Errors</CardTitle>
                </div>
                <CardDescription>
                  {validationErrors.length} issue(s) found. These rows will be skipped during
                  import.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {validationErrors.map((error, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-3 rounded-lg bg-warning/5 border border-warning/20"
                    >
                      <Badge variant="outline" className="shrink-0">
                        Row {error.row}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{error.field}</p>
                        <p className="text-xs text-muted-foreground">{error.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Ready to Process</CardTitle>
              <CardDescription>
                {validCount} record(s) will be imported
                {validationErrors.length > 0 && `, ${validationErrors.length} will be skipped`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center gap-4 py-6">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Upload Different File
                </Button>
                <Button
                  onClick={handleProcess}
                  disabled={isProcessing || validCount === 0}
                  className="gap-2"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4" />
                      Start Import
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'complete' && result && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mb-6">
                <CheckCircle className="h-10 w-10 text-success" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Upload Complete!</h2>
              <p className="text-muted-foreground mb-8">
                Successfully imported {result.success} out of {result.total} staff members
              </p>

              <div className="grid grid-cols-3 gap-8 mb-8">
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground">{result.total}</p>
                  <p className="text-sm text-muted-foreground">Total Records</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-success">{result.success}</p>
                  <p className="text-sm text-muted-foreground">Imported</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-destructive">{result.failed}</p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
              </div>

              {result.results && result.results.length > 0 && (
                <div className="w-full max-w-md mb-8">
                  <p className="text-sm font-medium mb-2">Imported Staff:</p>
                  <div className="max-h-48 overflow-y-auto space-y-1 text-left">
                    {result.results
                      .filter((r) => r.status === 'success')
                      .slice(0, 10)
                      .map((r, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm"
                        >
                          <span>Row {r.row}</span>
                          <Badge variant="outline" className="font-mono">
                            {r.employeeId}
                          </Badge>
                        </div>
                      ))}
                    {result.results.filter((r) => r.status === 'success').length > 10 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        +{result.results.filter((r) => r.status === 'success').length - 10} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button variant="outline" onClick={handleReset}>
                  Upload More
                </Button>
                <Button asChild>
                  <Link href="/hr/staff">
                    <Eye className="h-4 w-4 mr-2" />
                    View Staff
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
