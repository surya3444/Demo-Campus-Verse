'use client';

import * as React from 'react';
import { useCallback, useState } from 'react';
import { Upload, X, File, ImageIcon, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Progress } from './progress';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

interface FileUploaderProps {
  type: 'image' | 'document';
  onUpload: (file: File) => Promise<void>;
  accept?: string;
  maxSize?: number;
  className?: string;
  disabled?: boolean;
  preview?: string;
  onRemove?: () => void;
}

export function FileUploader({
  type,
  onUpload,
  accept,
  maxSize,
  className,
  disabled = false,
  preview,
  onRemove,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const allowedTypes = type === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_DOCUMENT_TYPES;
  const maxFileSize = maxSize ?? (type === 'image' ? MAX_IMAGE_SIZE : MAX_DOCUMENT_SIZE);
  const acceptTypes =
    accept ?? (type === 'image' ? 'image/jpeg,image/png,image/webp,image/gif' : '.pdf,.doc,.docx');

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!allowedTypes.includes(file.type)) {
        return `Invalid file type. Allowed: ${type === 'image' ? 'JPEG, PNG, WebP, GIF' : 'PDF, DOC, DOCX'}`;
      }
      if (file.size > maxFileSize) {
        return `File too large. Maximum size: ${Math.round(maxFileSize / 1024 / 1024)}MB`;
      }
      return null;
    },
    [allowedTypes, maxFileSize, type]
  );

  const handleFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      setSuccess(false);
      setUploading(true);
      setProgress(0);

      try {
        await onUpload(file);
        setSuccess(true);
        setProgress(100);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [onUpload, validateFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled || uploading) return;

      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [disabled, uploading, handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, uploading]);

  // Show preview if available
  if (preview && type === 'image') {
    return (
      <div className={cn('relative group', className)}>
        <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-border">
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={handleClick}
          disabled={disabled || uploading}
        >
          Change Photo
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptTypes}
          onChange={handleChange}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer',
          isDragging && 'border-primary bg-primary/5',
          !isDragging && 'border-border hover:border-primary/50 hover:bg-muted/50',
          (disabled || uploading) && 'opacity-50 cursor-not-allowed',
          error && 'border-destructive bg-destructive/5'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptTypes}
          onChange={handleChange}
          className="hidden"
          disabled={disabled || uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
            <Progress value={progress} className="w-40" />
          </div>
        ) : success ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-success" />
            <p className="text-sm text-success">Upload complete!</p>
          </div>
        ) : (
          <>
            <div className="p-3 rounded-full bg-muted mb-3">
              {type === 'image' ? (
                <ImageIcon className="w-6 h-6 text-muted-foreground" />
              ) : (
                <File className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Upload className="w-4 h-4" />
              <span className="font-medium">Click to upload</span>
              <span className="text-muted-foreground">or drag and drop</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {type === 'image' ? 'JPEG, PNG, WebP, GIF' : 'PDF, DOC, DOCX'} (max{' '}
              {Math.round(maxFileSize / 1024 / 1024)}MB)
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
