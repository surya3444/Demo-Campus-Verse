'use client';

import * as React from 'react';
import { useCallback, useState } from 'react';
import { Upload, Loader2, X, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadApi } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from './button';

interface LogoUploaderProps {
  entityType: 'organization' | 'branch';
  entityId: string;
  currentLogoUrl?: string | null;
  onUploadComplete?: (url: string, key: string) => void;
  onRemove?: () => void;
  className?: string;
  disabled?: boolean;
  aspectRatio?: 'square' | 'wide';
}

export function LogoUploader({
  entityType,
  entityId,
  currentLogoUrl,
  onUploadComplete,
  onRemove,
  className,
  disabled = false,
  aspectRatio = 'wide',
}: LogoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl ?? null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Update preview when currentLogoUrl changes
  React.useEffect(() => {
    setPreviewUrl(currentLogoUrl ?? null);
  }, [currentLogoUrl]);

  const handleUpload = useCallback(
    async (file: File) => {
      // Validate file
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Invalid file type. Please upload JPEG, PNG, WebP, or SVG.');
        return;
      }

      const maxSize = 5 * 1024 * 1024; // 5MB for logos
      if (file.size > maxSize) {
        toast.error('File too large. Maximum size is 5MB.');
        return;
      }

      setUploading(true);
      setProgress(0);

      // Show preview immediately
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      try {
        const apiEntityType = entityType === 'branch' ? 'organization' : entityType;
        const response = await uploadApi.uploadImage(apiEntityType, entityId, file, 'photo', (p) =>
          setProgress(p)
        );

        if (response.success && response.data) {
          toast.success('Logo uploaded successfully');
          onUploadComplete?.(response.data.url, response.data.key);
        } else {
          throw new Error(response.error?.message || 'Upload failed');
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to upload logo');
        setPreviewUrl(currentLogoUrl ?? null);
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [entityType, entityId, currentLogoUrl, onUploadComplete]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [handleUpload]
  );

  const handleClick = useCallback(() => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, uploading]);

  const handleRemove = useCallback(() => {
    setPreviewUrl(null);
    onRemove?.();
  }, [onRemove]);

  return (
    <div className={cn('space-y-3', className)}>
      <div
        onClick={handleClick}
        className={cn(
          'relative border-2 border-dashed rounded-lg cursor-pointer transition-all hover:border-primary/50 group bg-muted/30',
          aspectRatio === 'wide' ? 'h-32' : 'h-40 w-40',
          (disabled || uploading) && 'opacity-50 cursor-not-allowed'
        )}
      >
        {previewUrl ? (
          <div className="w-full h-full flex items-center justify-center p-4">
            <img src={previewUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon className="w-10 h-10" />
            <span className="text-sm">Click to upload logo</span>
            <span className="text-xs">PNG, JPG, SVG up to 5MB</span>
          </div>
        )}

        {/* Overlay on hover */}
        {!uploading && !disabled && previewUrl && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
            <Upload className="w-8 h-8 text-white" />
          </div>
        )}

        {/* Upload progress */}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center rounded-lg">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
            <span className="text-white text-sm mt-2">{progress}%</span>
          </div>
        )}
      </div>

      {/* Remove button */}
      {previewUrl && onRemove && !uploading && !disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
          className="gap-2"
        >
          <X className="w-4 h-4" />
          Remove Logo
        </Button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        onChange={handleChange}
        className="hidden"
        disabled={disabled || uploading}
      />
    </div>
  );
}
